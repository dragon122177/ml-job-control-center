export type Role = "ADMIN" | "OPERATOR" | "VIEWER";
export type JobStatus =
  | "SCHEDULED"
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";
export type JobType = "TRAINING" | "EVALUATION" | "DATA_PREPARATION" | "BATCH_INFERENCE";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type Session = {
  token: string;
  user: User;
};

export type Job = {
  id: string;
  projectId: string;
  projectName: string;
  experimentId?: string | null;
  experimentName?: string | null;
  datasetId?: string | null;
  datasetName?: string | null;
  modelId?: string | null;
  modelName?: string | null;
  modelVersion?: string | null;
  name: string;
  type: JobType;
  status: JobStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  framework: string;
  requestedGpu: number;
  requestedCpu: number;
  requestedMemoryGb: number;
  progress: number;
  attempt: number;
  maxRetries: number;
  durationSeconds: number;
  workerId?: string | null;
  workerName?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  errorMessage?: string | null;
  config: Record<string, unknown>;
};

export type JobEvent = {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  event: string;
  message: string;
  progress?: number;
  createdAt: string;
};

export type MetricPoint = {
  step: number;
  loss: number;
  accuracy: number;
  gpuUtilization: number;
  memoryUsedGb: number;
  createdAt: string;
};

export type JobDetail = Job & {
  events: JobEvent[];
  metrics: MetricPoint[];
};

export type Alert = {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED";
  source: string;
  createdAt: string;
};

export type Dashboard = {
  metrics: {
    runningJobs: number;
    waitingJobs: number;
    successRate: number;
    onlineWorkers: number;
    activeSlots: number;
    totalSlots: number;
    projects: number;
    registeredModels: number;
  };
  recentJobs: Job[];
  alerts: Alert[];
  statusDistribution: Array<{ status: JobStatus; count: number }>;
  generatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  environment: string;
  jobCount: number;
  modelCount: number;
  createdAt: string;
};

export type Dataset = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  version: string;
  rowsCount: number;
  sizeMb: number;
  storageUri: string;
  status: string;
  createdAt: string;
};

export type Experiment = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  ownerName: string;
  status: string;
  bestMetric?: number | null;
  runCount: number;
  createdAt: string;
};

export type Model = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  version: string;
  framework: string;
  stage: "PRODUCTION" | "STAGING" | "ARCHIVED";
  accuracy?: number | null;
  artifactUri: string;
  createdAt: string;
};

export type Worker = {
  id: string;
  name: string;
  pool: string;
  status: "ONLINE" | "DRAINING" | "OFFLINE";
  device: string;
  gpuMemoryGb: number;
  currentJobs: number;
  maxJobs: number;
  slotUtilization: number;
  lastHeartbeat: string;
};

export type AuditEvent = {
  id: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SystemStatus = {
  status: string;
  database: { mode: string; connected: boolean };
  scheduler: { queueDepth: number; activeJobs: number };
  runtime: { node: string; uptimeSeconds: number };
  checkedAt: string;
};

export type NavSection =
  | "overview"
  | "jobs"
  | "experiments"
  | "models"
  | "datasets"
  | "infrastructure"
  | "audit";
