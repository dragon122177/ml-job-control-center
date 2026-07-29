import { Router } from "express";
import type { Database } from "../db.js";
import { camelizeRows } from "../utils.js";

export function dashboardRoutes(db: Database): Router {
  const router = Router();

  router.get("/", async (_request, response) => {
    const [jobCounts, workerCounts, projectCount, modelCount, recentJobs, alerts, throughput] =
      await Promise.all([
        db.query<Record<string, number>>(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) AS running,
             SUM(CASE WHEN status IN ('QUEUED', 'SCHEDULED') THEN 1 ELSE 0 END) AS waiting,
             SUM(CASE WHEN status = 'SUCCEEDED' THEN 1 ELSE 0 END) AS succeeded,
             SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed
           FROM jobs`
        ),
        db.query<Record<string, number>>(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'ONLINE' THEN 1 ELSE 0 END) AS online,
             SUM(current_jobs) AS active_slots,
             SUM(max_jobs) AS total_slots
           FROM workers`
        ),
        db.query<{ count: number }>("SELECT COUNT(*) AS count FROM projects"),
        db.query<{ count: number }>("SELECT COUNT(*) AS count FROM models WHERE stage <> 'ARCHIVED'"),
        db.query<Record<string, unknown>>(
          `SELECT j.*, p.name AS project_name, w.name AS worker_name
           FROM jobs j
           JOIN projects p ON p.id = j.project_id
           LEFT JOIN workers w ON w.id = j.worker_id
           ORDER BY j.updated_at DESC
           LIMIT 6`
        ),
        db.query<Record<string, unknown>>(
          `SELECT * FROM alerts
           WHERE status = 'OPEN'
           ORDER BY
             CASE severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
             created_at DESC
           LIMIT 4`
        ),
        db.query<Record<string, unknown>>(
          `SELECT status, COUNT(*) AS count
           FROM jobs
           GROUP BY status
           ORDER BY status`
        )
      ]);

    const jobs = jobCounts.rows[0] ?? {};
    const workers = workerCounts.rows[0] ?? {};
    const succeeded = Number(jobs.succeeded ?? 0);
    const failed = Number(jobs.failed ?? 0);
    const finished = succeeded + failed;

    response.json({
      metrics: {
        runningJobs: Number(jobs.running ?? 0),
        waitingJobs: Number(jobs.waiting ?? 0),
        successRate: finished ? Number(((succeeded / finished) * 100).toFixed(1)) : 100,
        onlineWorkers: Number(workers.online ?? 0),
        activeSlots: Number(workers.active_slots ?? 0),
        totalSlots: Number(workers.total_slots ?? 0),
        projects: Number(projectCount.rows[0]?.count ?? 0),
        registeredModels: Number(modelCount.rows[0]?.count ?? 0)
      },
      recentJobs: camelizeRows(recentJobs.rows),
      alerts: camelizeRows(alerts.rows),
      statusDistribution: camelizeRows(throughput.rows),
      generatedAt: new Date().toISOString()
    });
  });

  return router;
}
