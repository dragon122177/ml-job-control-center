import type { Database } from "./db.js";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'development',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    rows_count INTEGER NOT NULL,
    size_mb NUMERIC NOT NULL,
    storage_uri TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL,
    best_metric NUMERIC,
    run_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    framework TEXT NOT NULL,
    stage TEXT NOT NULL,
    accuracy NUMERIC,
    artifact_uri TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    pool TEXT NOT NULL,
    status TEXT NOT NULL,
    device TEXT NOT NULL,
    gpu_memory_gb INTEGER NOT NULL,
    current_jobs INTEGER NOT NULL DEFAULT 0,
    max_jobs INTEGER NOT NULL DEFAULT 1,
    last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    experiment_id TEXT REFERENCES experiments(id),
    dataset_id TEXT REFERENCES datasets(id),
    model_id TEXT REFERENCES models(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    framework TEXT NOT NULL,
    requested_gpu INTEGER NOT NULL DEFAULT 0,
    requested_cpu INTEGER NOT NULL DEFAULT 2,
    requested_memory_gb INTEGER NOT NULL DEFAULT 4,
    progress INTEGER NOT NULL DEFAULT 0,
    attempt INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 2,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    failure_mode TEXT NOT NULL DEFAULT 'never',
    created_by TEXT NOT NULL REFERENCES users(id),
    worker_id TEXT REFERENCES workers(id),
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    config_json TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS job_events (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    level TEXT NOT NULL,
    event TEXT NOT NULL,
    message TEXT NOT NULL,
    progress INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    step INTEGER NOT NULL,
    loss NUMERIC NOT NULL,
    accuracy NUMERIC NOT NULL,
    gpu_utilization NUMERIC NOT NULL,
    memory_used_gb NUMERIC NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    source TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_metrics_job ON metrics(job_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at)`
];

export async function initializeSchema(db: Database): Promise<void> {
  for (const statement of schemaStatements) {
    await db.query(statement);
  }
}
