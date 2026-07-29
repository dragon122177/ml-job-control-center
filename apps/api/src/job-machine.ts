import type { JobStatus } from "./types.js";
import { AppError } from "./errors.js";

const transitions: Record<JobStatus, JobStatus[]> = {
  SCHEDULED: ["QUEUED", "CANCELLED"],
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: ["QUEUED"],
  CANCELLED: ["QUEUED"]
};

export function assertTransition(
  current: JobStatus,
  next: JobStatus,
  attempt: number,
  maxRetries: number
): void {
  if (!transitions[current].includes(next)) {
    throw new AppError(
      409,
      "INVALID_JOB_TRANSITION",
      `A job cannot transition from ${current} to ${next}.`
    );
  }

  if ((current === "FAILED" || current === "CANCELLED") && next === "QUEUED") {
    if (attempt > maxRetries) {
      throw new AppError(409, "RETRY_LIMIT_REACHED", "The job has reached its retry limit.");
    }
  }
}
