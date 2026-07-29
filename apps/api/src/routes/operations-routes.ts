import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { requireRole } from "../auth.js";
import { AppError } from "../errors.js";
import { RealtimeBus } from "../realtime.js";
import { camelizeRows, parseJson } from "../utils.js";
import { writeAudit } from "../audit.js";

export function operationsRoutes(db: Database, bus: RealtimeBus): Router {
  const router = Router();

  router.get("/workers", async (_request, response) => {
    const result = await db.query<Record<string, unknown>>(
      `SELECT w.*
       FROM workers w
       ORDER BY
         CASE status WHEN 'ONLINE' THEN 1 WHEN 'DRAINING' THEN 2 ELSE 3 END,
         name`
    );
    response.json({
      items: camelizeRows(result.rows).map((worker) => ({
        ...worker,
        slotUtilization: Number(worker.maxJobs)
          ? Math.round((Number(worker.currentJobs) * 100) / Number(worker.maxJobs))
          : 0
      }))
    });
  });

  router.patch("/workers/:workerId/status", requireRole("ADMIN"), async (request: AuthenticatedRequest, response) => {
    const workerId = request.params.workerId as string;
    const input = z.object({ status: z.enum(["ONLINE", "DRAINING", "OFFLINE"]) }).parse(request.body);
    const result = await db.query<{ id: string }>(
      `UPDATE workers SET status = $2, last_heartbeat = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id`,
      [workerId, input.status]
    );
    if (!result.rows[0]) throw new AppError(404, "WORKER_NOT_FOUND", "The worker does not exist.");
    await writeAudit(db, request.user!.id, "WORKER_STATUS_CHANGED", "worker", workerId, input);
    bus.publish({
      type: "worker.updated",
      entityId: workerId,
      at: new Date().toISOString()
    });
    response.json({ id: workerId, status: input.status });
  });

  router.get("/alerts", async (_request, response) => {
    const result = await db.query<Record<string, unknown>>(
      `SELECT * FROM alerts
       ORDER BY
         CASE status WHEN 'OPEN' THEN 1 ELSE 2 END,
         CASE severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         created_at DESC`
    );
    response.json({ items: camelizeRows(result.rows) });
  });

  router.post("/alerts/:alertId/acknowledge", requireRole("ADMIN", "OPERATOR"), async (request: AuthenticatedRequest, response) => {
    const alertId = request.params.alertId as string;
    const result = await db.query<{ id: string }>(
      `UPDATE alerts
       SET status = 'ACKNOWLEDGED', acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id`,
      [alertId]
    );
    if (!result.rows[0]) throw new AppError(404, "ALERT_NOT_FOUND", "The alert does not exist.");
    await writeAudit(db, request.user!.id, "ALERT_ACKNOWLEDGED", "alert", alertId);
    response.json({ id: alertId, status: "ACKNOWLEDGED" });
  });

  router.get("/audit", requireRole("ADMIN"), async (request, response) => {
    const limit = Math.min(Number(request.query.limit ?? 100), 250);
    const result = await db.query<Record<string, unknown>>(
      `SELECT a.*, u.name AS actor_name, u.email AS actor_email
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    response.json({
      items: camelizeRows(result.rows).map((event) => ({
        ...event,
        metadata: parseJson(event.metadataJson, {}),
        metadataJson: undefined
      }))
    });
  });

  router.get("/system", async (_request, response) => {
    const [database, queueDepth, active] = await Promise.all([
      db.query<{ now: Date }>("SELECT CURRENT_TIMESTAMP AS now"),
      db.query<{ count: number }>(
        "SELECT COUNT(*) AS count FROM jobs WHERE status IN ('QUEUED', 'SCHEDULED')"
      ),
      db.query<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE status = 'RUNNING'")
    ]);
    response.json({
      status: "operational",
      database: { mode: db.mode, connected: Boolean(database.rows[0]) },
      scheduler: {
        queueDepth: Number(queueDepth.rows[0]?.count ?? 0),
        activeJobs: Number(active.rows[0]?.count ?? 0)
      },
      runtime: {
        node: process.version,
        uptimeSeconds: Math.round(process.uptime())
      },
      checkedAt: new Date().toISOString()
    });
  });

  return router;
}
