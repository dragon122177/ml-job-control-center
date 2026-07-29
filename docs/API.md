# API guide

Base URL: `http://localhost:4100/api`

## Authentication

Authenticate with `POST /auth/login`, then send:

```http
Authorization: Bearer <token>
```

Demo request:

```bash
curl -X POST http://localhost:4100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mlcontrol.demo","password":"demo1234"}'
```

## Roles

| Capability | Admin | Operator | Viewer |
|---|---:|---:|---:|
| Read dashboards and catalogs | Yes | Yes | Yes |
| Create, cancel, retry jobs | Yes | Yes | No |
| Acknowledge alerts | Yes | Yes | No |
| Change worker status | Yes | No | No |
| Read audit history | Yes | No | No |

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Public health check |
| POST | `/auth/login` | Issue an eight-hour access token |
| GET | `/dashboard` | Operational summary |
| GET / POST | `/jobs` | Filter or create workloads |
| GET | `/jobs/:id` | Job configuration, metrics, and events |
| POST | `/jobs/:id/cancel` | Cancel a scheduled, queued, or running job |
| POST | `/jobs/:id/retry` | Requeue a failed or cancelled job |
| GET | `/catalog/projects` | Project catalog |
| GET | `/catalog/datasets` | Dataset versions and status |
| GET | `/catalog/experiments` | Experiment groups |
| GET | `/catalog/models` | Model registry |
| GET | `/operations/workers` | Worker capacity |
| GET | `/operations/alerts` | Operational alerts |
| POST | `/operations/alerts/:id/acknowledge` | Acknowledge an alert |
| GET | `/operations/audit` | Administrative audit history |
| GET | `/operations/system` | Runtime diagnostics |
| GET | `/events` | Authenticated server-sent event stream |

## Create a workload

```json
{
  "projectId": "prj_vision",
  "experimentId": "exp_yolo",
  "datasetId": "dts_images_v8",
  "name": "defect-detector-v2.6",
  "type": "TRAINING",
  "priority": "HIGH",
  "framework": "PyTorch",
  "requestedGpu": 1,
  "requestedCpu": 8,
  "requestedMemoryGb": 24,
  "maxRetries": 2,
  "config": {
    "epochs": 80,
    "batchSize": 32
  }
}
```

The endpoint returns `202 Accepted`. The scheduler assigns capacity independently
and emits lifecycle events through the realtime stream.

## Error contract

```json
{
  "error": {
    "code": "INVALID_JOB_TRANSITION",
    "message": "A job cannot transition from SUCCEEDED to RUNNING."
  }
}
```

Common status codes are `400` for invalid input, `401` for authentication,
`403` for authorization, `404` for missing resources, and `409` for state
conflicts.
