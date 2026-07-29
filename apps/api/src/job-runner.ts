import type { Database } from "./db.js";
import type { JobStatus } from "./types.js";
import { RealtimeBus } from "./realtime.js";
import { clamp, id } from "./utils.js";
import { writeAudit } from "./audit.js";

type RuntimeJob = {
  id: string;
  name: string;
  status: JobStatus;
  progress: number;
  attempt: number;
  max_retries: number;
  duration_seconds: number;
  failure_mode: string;
  worker_id: string | null;
  created_by: string;
};

type QueueJob = RuntimeJob & {
  requested_gpu: number;
  requested_memory_gb: number;
};

type Worker = {
  id: string;
  name: string;
  device: string;
};

export class JobRunner {
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly db: Database,
    private readonly bus: RealtimeBus,
    private readonly tickMs: number
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.releaseScheduledJobs();
      await this.advanceRunningJobs();
      await this.assignQueuedJobs();
      await this.refreshHeartbeats();
    } finally {
      this.busy = false;
    }
  }

  private async releaseScheduledJobs(): Promise<void> {
    const due = await this.db.query<{ id: string }>(
      `UPDATE jobs
       SET status = 'QUEUED', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'SCHEDULED' AND scheduled_at <= CURRENT_TIMESTAMP
       RETURNING id`
    );

    for (const job of due.rows) {
      await this.addEvent(job.id, "INFO", "SCHEDULE_RELEASED", "Scheduled job moved to the queue.", 0);
      this.publish(job.id, "QUEUED", 0);
    }
  }

  private async assignQueuedJobs(): Promise<void> {
    const queued = await this.db.query<QueueJob>(
      `SELECT *
       FROM jobs
       WHERE status = 'QUEUED'
       ORDER BY
         CASE priority
           WHEN 'CRITICAL' THEN 1
           WHEN 'HIGH' THEN 2
           WHEN 'NORMAL' THEN 3
           ELSE 4
         END,
         created_at ASC
       LIMIT 8`
    );

    for (const job of queued.rows) {
      const worker = await this.findWorker(job);
      if (!worker) continue;

      await this.db.query(
        `UPDATE jobs
         SET status = 'RUNNING',
             worker_id = $2,
             attempt = attempt + 1,
             started_at = CURRENT_TIMESTAMP,
             finished_at = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'QUEUED'`,
        [job.id, worker.id]
      );
      await this.db.query(
        `UPDATE workers
         SET current_jobs = current_jobs + 1, last_heartbeat = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [worker.id]
      );
      await this.addEvent(
        job.id,
        "INFO",
        "WORKER_ASSIGNED",
        `Assigned to ${worker.name} (${worker.device}).`,
        job.progress
      );
      this.publish(job.id, "RUNNING", job.progress);
    }
  }

  private async findWorker(job: QueueJob): Promise<Worker | undefined> {
    const result = await this.db.query<Worker>(
      `SELECT id, name, device
       FROM workers
       WHERE status = 'ONLINE'
         AND current_jobs < max_jobs
         AND ($1 = 0 OR device <> 'CPU · 32 cores')
         AND ($1 = 0 OR gpu_memory_gb >= $2)
       ORDER BY current_jobs ASC, gpu_memory_gb DESC
       LIMIT 1`,
      [job.requested_gpu, job.requested_memory_gb]
    );
    return result.rows[0];
  }

  private async advanceRunningJobs(): Promise<void> {
    const running = await this.db.query<RuntimeJob>(
      "SELECT * FROM jobs WHERE status = 'RUNNING' ORDER BY started_at ASC"
    );

    for (const job of running.rows) {
      const nextProgress = clamp(job.progress + 7 + (job.attempt % 4), 0, 100);
      const nextDuration = job.duration_seconds + Math.max(1, Math.round(this.tickMs / 1000));

      if (
        (job.failure_mode === "always" || (job.failure_mode === "once" && job.attempt === 1))
        && nextProgress >= 45
      ) {
        await this.failJob(job, nextProgress, nextDuration);
        continue;
      }

      if (nextProgress >= 100) {
        await this.completeJob(job, nextDuration);
        continue;
      }

      await this.db.query(
        `UPDATE jobs
         SET progress = $2, duration_seconds = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'RUNNING'`,
        [job.id, nextProgress, nextDuration]
      );
      await this.recordMetric(job.id, nextProgress);

      if (nextProgress % 20 < 10 && job.progress % 20 >= 10) {
        await this.addEvent(
          job.id,
          "INFO",
          "CHECKPOINT",
          `Checkpoint persisted at ${nextProgress}% progress.`,
          nextProgress
        );
      }
      this.publish(job.id, "RUNNING", nextProgress);
    }
  }

  private async completeJob(job: RuntimeJob, duration: number): Promise<void> {
    await this.db.query(
      `UPDATE jobs
       SET status = 'SUCCEEDED',
           progress = 100,
           duration_seconds = $2,
           finished_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [job.id, duration]
    );
    await this.releaseWorker(job.worker_id);
    await this.recordMetric(job.id, 100);
    await this.addEvent(job.id, "INFO", "JOB_COMPLETED", "Job completed successfully.", 100);
    await writeAudit(this.db, job.created_by, "JOB_COMPLETED", "job", job.id, { attempt: job.attempt });
    this.publish(job.id, "SUCCEEDED", 100);
  }

  private async failJob(job: RuntimeJob, progress: number, duration: number): Promise<void> {
    const message = "Worker reported a simulated runtime failure.";
    await this.db.query(
      `UPDATE jobs
       SET status = 'FAILED',
           progress = $2,
           duration_seconds = $3,
           error_message = $4,
           finished_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           failure_mode = CASE WHEN failure_mode = 'once' THEN 'never' ELSE failure_mode END
       WHERE id = $1`,
      [job.id, progress, duration, message]
    );
    await this.releaseWorker(job.worker_id);
    await this.addEvent(job.id, "ERROR", "JOB_FAILED", message, progress);
    this.publish(job.id, "FAILED", progress);

    if (job.attempt <= job.max_retries) {
      await this.db.query(
        `UPDATE jobs
         SET status = 'QUEUED', worker_id = NULL, progress = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [job.id]
      );
      await this.addEvent(
        job.id,
        "WARN",
        "RETRY_SCHEDULED",
        `Automatic retry ${job.attempt + 1} of ${job.max_retries + 1} queued.`,
        0
      );
      this.publish(job.id, "QUEUED", 0);
      return;
    }

    const alertId = id("alt");
    await this.db.query(
      `INSERT INTO alerts
        (id, severity, title, message, status, source, created_at)
       VALUES ($1, 'HIGH', $2, $3, 'OPEN', 'scheduler', CURRENT_TIMESTAMP)`,
      [alertId, "Job exhausted its retry policy", `${job.name} failed after ${job.attempt} attempts.`]
    );
    this.bus.publish({
      type: "alert.created",
      entityId: alertId,
      at: new Date().toISOString()
    });
  }

  private async releaseWorker(workerId: string | null): Promise<void> {
    if (!workerId) return;
    await this.db.query(
      `UPDATE workers
       SET current_jobs = CASE WHEN current_jobs > 0 THEN current_jobs - 1 ELSE 0 END,
           last_heartbeat = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [workerId]
    );
    this.bus.publish({
      type: "worker.updated",
      entityId: workerId,
      at: new Date().toISOString()
    });
  }

  private async recordMetric(jobId: string, progress: number): Promise<void> {
    const normalized = progress / 100;
    const loss = Number((1.25 * Math.exp(-3.1 * normalized) + 0.055).toFixed(4));
    const accuracy = Number(clamp(0.57 + normalized * 0.4, 0, 0.978).toFixed(4));
    const gpu = Math.round(74 + Math.sin(progress) * 8 + normalized * 9);
    const memory = Number((11.5 + normalized * 29).toFixed(2));

    await this.db.query(
      `INSERT INTO metrics
        (id, job_id, step, loss, accuracy, gpu_utilization, memory_used_gb, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [id("met"), jobId, progress, loss, accuracy, gpu, memory]
    );
  }

  private async addEvent(
    jobId: string,
    level: string,
    event: string,
    message: string,
    progress: number
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO job_events
        (id, job_id, level, event, message, progress, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [id("evt"), jobId, level, event, message, progress]
    );
  }

  private publish(jobId: string, status: JobStatus, progress: number): void {
    this.bus.publish({
      type: "job.updated",
      entityId: jobId,
      status,
      progress,
      at: new Date().toISOString()
    });
  }

  private async refreshHeartbeats(): Promise<void> {
    await this.db.query(
      "UPDATE workers SET last_heartbeat = CURRENT_TIMESTAMP WHERE status IN ('ONLINE', 'DRAINING')"
    );
  }
}
