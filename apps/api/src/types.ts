import type { Request } from "express";

export const ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const JOB_STATUSES = [
  "SCHEDULED",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED"
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TYPES = [
  "TRAINING",
  "EVALUATION",
  "DATA_PREPARATION",
  "BATCH_INFERENCE"
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type UserIdentity = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type AuthenticatedRequest = Request & {
  user?: UserIdentity;
};

export type JobEventPayload = {
  type: "job.updated" | "job.created" | "alert.created" | "worker.updated";
  entityId: string;
  status?: JobStatus;
  progress?: number;
  at: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
