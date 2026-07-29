import bcrypt from "bcryptjs";
import type { Database } from "./db.js";
import { id, safeJson } from "./utils.js";

const ago = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);
const ahead = (minutes: number): Date => new Date(Date.now() + minutes * 60_000);

async function insert(
  db: Database,
  table: string,
  record: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(record);
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ");
  await db.query(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
    Object.values(record)
  );
}

export async function seedDatabase(db: Database): Promise<void> {
  const existing = await db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
  if (Number(existing.rows[0]?.count ?? 0) > 0) return;

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const users = [
    { id: "usr_admin", email: "admin@mlcontrol.demo", name: "Maya Chen", password_hash: passwordHash, role: "ADMIN", created_at: ago(20_000) },
    { id: "usr_operator", email: "operator@mlcontrol.demo", name: "Noah Williams", password_hash: passwordHash, role: "OPERATOR", created_at: ago(18_000) },
    { id: "usr_viewer", email: "viewer@mlcontrol.demo", name: "Amina Diallo", password_hash: passwordHash, role: "VIEWER", created_at: ago(16_000) }
  ];
  for (const user of users) await insert(db, "users", user);

  const projects = [
    { id: "prj_vision", name: "Vision Quality", slug: "vision-quality", description: "Visual defect detection for manufacturing lines.", environment: "production", created_at: ago(15_000) },
    { id: "prj_fraud", name: "Fraud Shield", slug: "fraud-shield", description: "Transaction risk scoring and model evaluation.", environment: "staging", created_at: ago(12_000) },
    { id: "prj_demand", name: "Demand Forecast", slug: "demand-forecast", description: "Regional inventory and demand forecasting.", environment: "development", created_at: ago(9_000) }
  ];
  for (const project of projects) await insert(db, "projects", project);

  const datasets = [
    { id: "dts_images_v8", project_id: "prj_vision", name: "assembly-line-images", version: "v8.2", rows_count: 248_900, size_mb: 18_420, storage_uri: "s3://demo-data/vision/v8.2", status: "READY", created_at: ago(4_320) },
    { id: "dts_tx_v12", project_id: "prj_fraud", name: "transactions-clean", version: "v12", rows_count: 4_820_000, size_mb: 7_840, storage_uri: "s3://demo-data/fraud/v12", status: "READY", created_at: ago(2_880) },
    { id: "dts_demand_q2", project_id: "prj_demand", name: "regional-demand", version: "2026-Q2", rows_count: 982_400, size_mb: 2_140, storage_uri: "s3://demo-data/demand/2026-Q2", status: "READY", created_at: ago(1_440) },
    { id: "dts_images_raw", project_id: "prj_vision", name: "camera-ingest-raw", version: "v9-rc1", rows_count: 312_450, size_mb: 27_900, storage_uri: "s3://demo-data/vision/v9-rc1", status: "VALIDATING", created_at: ago(180) }
  ];
  for (const dataset of datasets) await insert(db, "datasets", dataset);

  const experiments = [
    { id: "exp_yolo", project_id: "prj_vision", name: "YOLOv11 defect baseline", owner_id: "usr_operator", status: "ACTIVE", best_metric: 0.941, run_count: 18, created_at: ago(6_400) },
    { id: "exp_fraud", project_id: "prj_fraud", name: "LightGBM threshold sweep", owner_id: "usr_admin", status: "ACTIVE", best_metric: 0.918, run_count: 31, created_at: ago(5_600) },
    { id: "exp_tft", project_id: "prj_demand", name: "Temporal Fusion Transformer", owner_id: "usr_operator", status: "PAUSED", best_metric: 0.873, run_count: 9, created_at: ago(3_800) }
  ];
  for (const experiment of experiments) await insert(db, "experiments", experiment);

  const models = [
    { id: "mdl_vision_23", project_id: "prj_vision", name: "defect-detector", version: "2.3.0", framework: "PyTorch", stage: "PRODUCTION", accuracy: 0.941, artifact_uri: "s3://demo-models/defect/2.3.0", created_at: ago(2_200) },
    { id: "mdl_vision_24", project_id: "prj_vision", name: "defect-detector", version: "2.4.0-rc2", framework: "PyTorch", stage: "STAGING", accuracy: 0.948, artifact_uri: "s3://demo-models/defect/2.4.0-rc2", created_at: ago(350) },
    { id: "mdl_fraud_51", project_id: "prj_fraud", name: "risk-scorer", version: "5.1.0", framework: "LightGBM", stage: "PRODUCTION", accuracy: 0.918, artifact_uri: "s3://demo-models/risk/5.1.0", created_at: ago(1_900) },
    { id: "mdl_demand_08", project_id: "prj_demand", name: "demand-forecaster", version: "0.8.4", framework: "TensorFlow", stage: "ARCHIVED", accuracy: 0.856, artifact_uri: "s3://demo-models/demand/0.8.4", created_at: ago(4_000) }
  ];
  for (const model of models) await insert(db, "models", model);

  const workers = [
    { id: "wrk_a100_01", name: "gpu-a100-01", pool: "gpu-production", status: "ONLINE", device: "NVIDIA A100", gpu_memory_gb: 80, current_jobs: 1, max_jobs: 2, last_heartbeat: ago(0) },
    { id: "wrk_a100_02", name: "gpu-a100-02", pool: "gpu-production", status: "ONLINE", device: "NVIDIA A100", gpu_memory_gb: 80, current_jobs: 0, max_jobs: 2, last_heartbeat: ago(0) },
    { id: "wrk_l4_01", name: "gpu-l4-01", pool: "gpu-inference", status: "ONLINE", device: "NVIDIA L4", gpu_memory_gb: 24, current_jobs: 0, max_jobs: 3, last_heartbeat: ago(0) },
    { id: "wrk_cpu_01", name: "cpu-batch-01", pool: "cpu-batch", status: "ONLINE", device: "CPU · 32 cores", gpu_memory_gb: 0, current_jobs: 0, max_jobs: 4, last_heartbeat: ago(0) },
    { id: "wrk_l4_02", name: "gpu-l4-02", pool: "gpu-inference", status: "DRAINING", device: "NVIDIA L4", gpu_memory_gb: 24, current_jobs: 0, max_jobs: 3, last_heartbeat: ago(2) }
  ];
  for (const worker of workers) await insert(db, "workers", worker);

  const jobs = [
    {
      id: "job_train_live", project_id: "prj_vision", experiment_id: "exp_yolo", dataset_id: "dts_images_v8", model_id: null,
      name: "defect-detector-v2.5", type: "TRAINING", status: "RUNNING", priority: "HIGH", framework: "PyTorch",
      requested_gpu: 1, requested_cpu: 8, requested_memory_gb: 24, progress: 64, attempt: 1, max_retries: 2,
      duration_seconds: 628, failure_mode: "never", created_by: "usr_operator", worker_id: "wrk_a100_01",
      scheduled_at: null, started_at: ago(11), finished_at: null, created_at: ago(14), updated_at: ago(0),
      error_message: null, config_json: safeJson({ epochs: 80, batchSize: 32, learningRate: 0.0003 })
    },
    {
      id: "job_eval_queue", project_id: "prj_fraud", experiment_id: "exp_fraud", dataset_id: "dts_tx_v12", model_id: "mdl_fraud_51",
      name: "risk-scorer-bias-evaluation", type: "EVALUATION", status: "QUEUED", priority: "CRITICAL", framework: "LightGBM",
      requested_gpu: 0, requested_cpu: 6, requested_memory_gb: 12, progress: 0, attempt: 0, max_retries: 1,
      duration_seconds: 0, failure_mode: "never", created_by: "usr_admin", worker_id: null,
      scheduled_at: null, started_at: null, finished_at: null, created_at: ago(6), updated_at: ago(6),
      error_message: null, config_json: safeJson({ slices: ["region", "age_band"], threshold: 0.72 })
    },
    {
      id: "job_data_queue", project_id: "prj_vision", experiment_id: null, dataset_id: "dts_images_raw", model_id: null,
      name: "normalize-camera-ingest-v9", type: "DATA_PREPARATION", status: "QUEUED", priority: "NORMAL", framework: "Python",
      requested_gpu: 0, requested_cpu: 8, requested_memory_gb: 16, progress: 0, attempt: 0, max_retries: 2,
      duration_seconds: 0, failure_mode: "never", created_by: "usr_operator", worker_id: null,
      scheduled_at: null, started_at: null, finished_at: null, created_at: ago(4), updated_at: ago(4),
      error_message: null, config_json: safeJson({ resize: 1024, validateLabels: true })
    },
    {
      id: "job_inference_scheduled", project_id: "prj_demand", experiment_id: "exp_tft", dataset_id: "dts_demand_q2", model_id: "mdl_demand_08",
      name: "weekly-demand-forecast", type: "BATCH_INFERENCE", status: "SCHEDULED", priority: "NORMAL", framework: "TensorFlow",
      requested_gpu: 1, requested_cpu: 4, requested_memory_gb: 12, progress: 0, attempt: 0, max_retries: 2,
      duration_seconds: 0, failure_mode: "never", created_by: "usr_operator", worker_id: null,
      scheduled_at: ahead(30), started_at: null, finished_at: null, created_at: ago(3), updated_at: ago(3),
      error_message: null, config_json: safeJson({ horizonDays: 28, regions: 42 })
    },
    {
      id: "job_success_1", project_id: "prj_vision", experiment_id: "exp_yolo", dataset_id: "dts_images_v8", model_id: "mdl_vision_24",
      name: "defect-detector-v2.4-validation", type: "EVALUATION", status: "SUCCEEDED", priority: "HIGH", framework: "PyTorch",
      requested_gpu: 1, requested_cpu: 6, requested_memory_gb: 16, progress: 100, attempt: 1, max_retries: 2,
      duration_seconds: 1_842, failure_mode: "never", created_by: "usr_operator", worker_id: "wrk_a100_02",
      scheduled_at: null, started_at: ago(183), finished_at: ago(152), created_at: ago(185), updated_at: ago(152),
      error_message: null, config_json: safeJson({ validationSplit: 0.2 })
    },
    {
      id: "job_success_2", project_id: "prj_fraud", experiment_id: "exp_fraud", dataset_id: "dts_tx_v12", model_id: "mdl_fraud_51",
      name: "fraud-threshold-grid-search", type: "EVALUATION", status: "SUCCEEDED", priority: "NORMAL", framework: "LightGBM",
      requested_gpu: 0, requested_cpu: 12, requested_memory_gb: 20, progress: 100, attempt: 1, max_retries: 1,
      duration_seconds: 892, failure_mode: "never", created_by: "usr_admin", worker_id: "wrk_cpu_01",
      scheduled_at: null, started_at: ago(410), finished_at: ago(395), created_at: ago(414), updated_at: ago(395),
      error_message: null, config_json: safeJson({ thresholds: 24 })
    },
    {
      id: "job_failed_demo", project_id: "prj_demand", experiment_id: "exp_tft", dataset_id: "dts_demand_q2", model_id: null,
      name: "tft-hyperparameter-sweep-09", type: "TRAINING", status: "FAILED", priority: "LOW", framework: "TensorFlow",
      requested_gpu: 1, requested_cpu: 8, requested_memory_gb: 40, progress: 47, attempt: 3, max_retries: 2,
      duration_seconds: 2_117, failure_mode: "never", created_by: "usr_operator", worker_id: "wrk_a100_02",
      scheduled_at: null, started_at: ago(760), finished_at: ago(724), created_at: ago(800), updated_at: ago(724),
      error_message: "CUDA out of memory while allocating attention tensor", config_json: safeJson({ hiddenSize: 512, batchSize: 128 })
    }
  ];
  for (const job of jobs) await insert(db, "jobs", job);

  const events = [
    ["job_train_live", "INFO", "JOB_CREATED", "Job accepted by the control plane.", 0, ago(14)],
    ["job_train_live", "INFO", "WORKER_ASSIGNED", "Assigned to gpu-a100-01.", 0, ago(11)],
    ["job_train_live", "INFO", "CHECKPOINT", "Checkpoint persisted at epoch 32.", 40, ago(5)],
    ["job_train_live", "INFO", "METRIC_IMPROVED", "Validation mAP improved to 0.932.", 58, ago(2)],
    ["job_eval_queue", "INFO", "JOB_CREATED", "Critical evaluation queued.", 0, ago(6)],
    ["job_failed_demo", "INFO", "WORKER_ASSIGNED", "Assigned to gpu-a100-02.", 0, ago(760)],
    ["job_failed_demo", "ERROR", "JOB_FAILED", "CUDA out of memory while allocating attention tensor.", 47, ago(724)],
    ["job_success_1", "INFO", "JOB_COMPLETED", "Validation completed successfully.", 100, ago(152)],
    ["job_success_2", "INFO", "JOB_COMPLETED", "Threshold search completed successfully.", 100, ago(395)]
  ];
  for (const [jobId, level, event, message, progress, createdAt] of events) {
    await insert(db, "job_events", {
      id: id("evt"), job_id: jobId, level, event, message, progress, created_at: createdAt
    });
  }

  for (let step = 1; step <= 8; step += 1) {
    await insert(db, "metrics", {
      id: id("met"),
      job_id: "job_train_live",
      step: step * 8,
      loss: Number((1.18 * Math.exp(-step / 4) + 0.08).toFixed(4)),
      accuracy: Number((0.61 + step * 0.04).toFixed(4)),
      gpu_utilization: 82 + (step % 3) * 4,
      memory_used_gb: 36 + step * 0.7,
      created_at: ago(10 - step)
    });
  }

  const alerts = [
    { id: "alt_memory", severity: "HIGH", title: "Training job exhausted retries", message: "tft-hyperparameter-sweep-09 failed after three attempts.", status: "OPEN", source: "scheduler", created_at: ago(724), acknowledged_at: null },
    { id: "alt_worker", severity: "MEDIUM", title: "Worker entered draining mode", message: "gpu-l4-02 will stop accepting new workloads.", status: "OPEN", source: "worker-monitor", created_at: ago(22), acknowledged_at: null },
    { id: "alt_dataset", severity: "LOW", title: "Dataset validation in progress", message: "camera-ingest-raw v9-rc1 is not ready for production training.", status: "ACKNOWLEDGED", source: "data-quality", created_at: ago(180), acknowledged_at: ago(170) }
  ];
  for (const alert of alerts) await insert(db, "alerts", alert);

  const audits = [
    { actor_id: "usr_admin", action: "MODEL_PROMOTED", entity_type: "model", entity_id: "mdl_vision_23", metadata_json: safeJson({ stage: "PRODUCTION" }), created_at: ago(2_200) },
    { actor_id: "usr_operator", action: "JOB_CREATED", entity_type: "job", entity_id: "job_train_live", metadata_json: safeJson({ type: "TRAINING" }), created_at: ago(14) },
    { actor_id: "usr_admin", action: "JOB_CREATED", entity_type: "job", entity_id: "job_eval_queue", metadata_json: safeJson({ priority: "CRITICAL" }), created_at: ago(6) }
  ];
  for (const audit of audits) {
    await insert(db, "audit_events", { id: id("aud"), ...audit });
  }
}
