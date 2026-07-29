import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db.js";
import type { AuthenticatedRequest, JobStatus } from "../types.js";
import { requireRole } from "../auth.js";
import { AppError } from "../errors.js";
import { assertTransition } from "../job-machine.js";
import { RealtimeBus } from "../realtime.js";
import { camelize, camelizeRows, id, parseJson, safeJson } from "../utils.js";
import { writeAudit } from "../audit.js";

const createJobSchema = z.object({
  projectId: z.string().min(1),
  experimentId: z.string().min(1).nullable().optional(),
  datasetId: z.string().min(1).nullable().optional(),
  modelId: z.string().min(1).nullable().optional(),
  name: z.string().min(3).max(120),
  type: z.enum(["TRAINING", "EVALUATION", "DATA_PREPARATION", "BATCH_INFERENCE"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  framework: z.string().min(2).max(40),
  requestedGpu: z.number().int().min(0).max(8).default(0),
  requestedCpu: z.number().int().min(1).max(64).default(2),
  requestedMemoryGb: z.number().int().min(1).max(512).default(4),
  maxRetries: z.number().int().min(0).max(5).default(2),
  scheduledAt: z.iso.datetime().nullable().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  failureMode: z.enum(["never", "once", "always"]).default("never")
});

type JobRecord = {
  id: string;
  status: JobStatus;
  progress: number;
  attempt: number;
  max_retries: number;
  worker_id: string | null;
  created_by: string;
  [key: string]: unknown;
};

function presentJob(row: Record<string, unknown>): Record<string, unknown> {
  const job = camelize<Record<string, unknown>>(row);
  job.config = parseJson(job.configJson, {});
  delete job.configJson;
  for (const key of [
    "requestedGpu",
    "requestedCpu",
    "requestedMemoryGb",
    "progress",
    "attempt",
    "maxRetries",
    "durationSeconds"
  ]) {
    if (job[key] !== null && job[key] !== undefined) job[key] = Number(job[key]);
  }
  return job;
}

async function findJob(db: Database, jobId: string): Promise<JobRecord> {
  const result = await db.query<JobRecord>("SELECT * FROM jobs WHERE id = $1", [jobId]);
  const job = result.rows[0];
  if (!job) throw new AppError(404, "JOB_NOT_FOUND", "The requested job does not exist.");
  return job;
}

async function addJobEvent(
  db: Database,
  jobId: string,
  level: string,
  event: string,
  message: string,
  progress: number
): Promise<void> {
  await db.query(
    `INSERT INTO job_events
      (id, job_id, level, event, message, progress, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [id("evt"), jobId, level, event, message, progress]
  );
}

export function jobRoutes(db: Database, bus: RealtimeBus): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const status = typeof request.query.status === "string" ? request.query.status : null;
    const projectId = typeof request.query.projectId === "string" ? request.query.projectId : null;
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (status) {
      values.push(status);
      conditions.push(`j.status = $${values.length}`);
    }
    if (projectId) {
      values.push(projectId);
      conditions.push(`j.project_id = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`LOWER(j.name) LIKE LOWER($${values.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await db.query<Record<string, unknown>>(
      `SELECT j.*, p.name AS project_name, w.name AS worker_name,
              u.name AS created_by_name
       FROM jobs j
       JOIN projects p ON p.id = j.project_id
       JOIN users u ON u.id = j.created_by
       LEFT JOIN workers w ON w.id = j.worker_id
       ${where}
       ORDER BY
         CASE j.status
           WHEN 'RUNNING' THEN 1
           WHEN 'QUEUED' THEN 2
           WHEN 'SCHEDULED' THEN 3
           ELSE 4
         END,
         j.updated_at DESC`,
      values
    );

    const counts = await db.query<Record<string, unknown>>(
      "SELECT status, COUNT(*) AS count FROM jobs GROUP BY status"
    );
    response.json({
      items: result.rows.map(presentJob),
      counts: Object.fromEntries(counts.rows.map((row) => [row.status, Number(row.count)]))
    });
  });

  router.post("/", requireRole("ADMIN", "OPERATOR"), async (request: AuthenticatedRequest, response) => {
    const input = createJobSchema.parse(request.body);
    const jobId = id("job");
    const scheduledDate = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const status: JobStatus =
      scheduledDate && scheduledDate.getTime() > Date.now() ? "SCHEDULED" : "QUEUED";

    await db.query(
      `INSERT INTO jobs (
        id, project_id, experiment_id, dataset_id, model_id, name, type, status,
        priority, framework, requested_gpu, requested_cpu, requested_memory_gb,
        progress, attempt, max_retries, duration_seconds, failure_mode, created_by,
        scheduled_at, created_at, updated_at, config_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        0, 0, $14, 0, $15, $16,
        $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $18
      )`,
      [
        jobId,
        input.projectId,
        input.experimentId ?? null,
        input.datasetId ?? null,
        input.modelId ?? null,
        input.name,
        input.type,
        status,
        input.priority,
        input.framework,
        input.requestedGpu,
        input.requestedCpu,
        input.requestedMemoryGb,
        input.maxRetries,
        input.failureMode,
        request.user!.id,
        scheduledDate,
        safeJson(input.config)
      ]
    );
    await addJobEvent(
      db,
      jobId,
      "INFO",
      "JOB_CREATED",
      status === "SCHEDULED"
        ? `Job scheduled for ${scheduledDate!.toISOString()}.`
        : "Job accepted by the control plane.",
      0
    );
    await writeAudit(db, request.user!.id, "JOB_CREATED", "job", jobId, {
      type: input.type,
      priority: input.priority,
      status
    });
    bus.publish({
      type: "job.created",
      entityId: jobId,
      status,
      progress: 0,
      at: new Date().toISOString()
    });

    const created = await db.query<Record<string, unknown>>("SELECT * FROM jobs WHERE id = $1", [jobId]);
    response.status(202).json(presentJob(created.rows[0]!));
  });

  router.get("/:jobId", async (request, response) => {
    const result = await db.query<Record<string, unknown>>(
      `SELECT j.*, p.name AS project_name, w.name AS worker_name,
              u.name AS created_by_name, d.name AS dataset_name,
              e.name AS experiment_name, m.name AS model_name, m.version AS model_version
       FROM jobs j
       JOIN projects p ON p.id = j.project_id
       JOIN users u ON u.id = j.created_by
       LEFT JOIN workers w ON w.id = j.worker_id
       LEFT JOIN datasets d ON d.id = j.dataset_id
       LEFT JOIN experiments e ON e.id = j.experiment_id
       LEFT JOIN models m ON m.id = j.model_id
       WHERE j.id = $1`,
      [request.params.jobId]
    );
    if (!result.rows[0]) throw new AppError(404, "JOB_NOT_FOUND", "The requested job does not exist.");

    const [events, metrics] = await Promise.all([
      db.query<Record<string, unknown>>(
        "SELECT * FROM job_events WHERE job_id = $1 ORDER BY created_at DESC LIMIT 100",
        [request.params.jobId]
      ),
      db.query<Record<string, unknown>>(
        "SELECT * FROM metrics WHERE job_id = $1 ORDER BY step ASC LIMIT 200",
        [request.params.jobId]
      )
    ]);

    response.json({
      ...presentJob(result.rows[0]),
      events: camelizeRows(events.rows),
      metrics: camelizeRows(metrics.rows).map((metric) => ({
        ...metric,
        step: Number(metric.step),
        loss: Number(metric.loss),
        accuracy: Number(metric.accuracy),
        gpuUtilization: Number(metric.gpuUtilization),
        memoryUsedGb: Number(metric.memoryUsedGb)
      }))
    });
  });

  router.post("/:jobId/cancel", requireRole("ADMIN", "OPERATOR"), async (request: AuthenticatedRequest, response) => {
    const job = await findJob(db, request.params.jobId as string);
    assertTransition(job.status, "CANCELLED", job.attempt, job.max_retries);

    await db.query(
      `UPDATE jobs
       SET status = 'CANCELLED', finished_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [job.id]
    );
    if (job.worker_id) {
      await db.query(
        `UPDATE workers
         SET current_jobs = CASE WHEN current_jobs > 0 THEN current_jobs - 1 ELSE 0 END
         WHERE id = $1`,
        [job.worker_id]
      );
    }
    await addJobEvent(db, job.id, "WARN", "JOB_CANCELLED", `Cancelled by ${request.user!.name}.`, job.progress);
    await writeAudit(db, request.user!.id, "JOB_CANCELLED", "job", job.id);
    bus.publish({
      type: "job.updated",
      entityId: job.id,
      status: "CANCELLED",
      progress: job.progress,
      at: new Date().toISOString()
    });
    response.status(202).json({ id: job.id, status: "CANCELLED" });
  });

  router.post("/:jobId/retry", requireRole("ADMIN", "OPERATOR"), async (request: AuthenticatedRequest, response) => {
    const job = await findJob(db, request.params.jobId as string);
    assertTransition(job.status, "QUEUED", job.attempt, job.max_retries);

    await db.query(
      `UPDATE jobs
       SET status = 'QUEUED', progress = 0, worker_id = NULL,
           error_message = NULL, started_at = NULL, finished_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [job.id]
    );
    await addJobEvent(db, job.id, "INFO", "MANUAL_RETRY", `Retry requested by ${request.user!.name}.`, 0);
    await writeAudit(db, request.user!.id, "JOB_RETRIED", "job", job.id, { attempt: job.attempt + 1 });
    bus.publish({
      type: "job.updated",
      entityId: job.id,
      status: "QUEUED",
      progress: 0,
      at: new Date().toISOString()
    });
    response.status(202).json({ id: job.id, status: "QUEUED" });
  });

  return router;
}
