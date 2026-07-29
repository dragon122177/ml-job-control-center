import { Router } from "express";
import { z } from "zod";
import type { Database } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { requireRole } from "../auth.js";
import { camelizeRows, id } from "../utils.js";
import { writeAudit } from "../audit.js";

export function catalogRoutes(db: Database): Router {
  const router = Router();

  router.get("/projects", async (_request, response) => {
    const [projects, jobCounts, modelCounts] = await Promise.all([
      db.query<Record<string, unknown>>("SELECT * FROM projects ORDER BY name"),
      db.query<{ project_id: string; count: number }>(
        "SELECT project_id, COUNT(*) AS count FROM jobs GROUP BY project_id"
      ),
      db.query<{ project_id: string; count: number }>(
        "SELECT project_id, COUNT(*) AS count FROM models GROUP BY project_id"
      )
    ]);
    const jobsByProject = new Map(jobCounts.rows.map((row) => [row.project_id, Number(row.count)]));
    const modelsByProject = new Map(modelCounts.rows.map((row) => [row.project_id, Number(row.count)]));
    response.json({
      items: camelizeRows(projects.rows).map((project) => ({
        ...project,
        jobCount: jobsByProject.get(String(project.id)) ?? 0,
        modelCount: modelsByProject.get(String(project.id)) ?? 0
      }))
    });
  });

  router.post("/projects", requireRole("ADMIN", "OPERATOR"), async (request: AuthenticatedRequest, response) => {
    const input = z.object({
      name: z.string().min(3).max(80),
      slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(80),
      description: z.string().min(10).max(300),
      environment: z.enum(["development", "staging", "production"])
    }).parse(request.body);
    const projectId = id("prj");
    await db.query(
      `INSERT INTO projects (id, name, slug, description, environment, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [projectId, input.name, input.slug, input.description, input.environment]
    );
    await writeAudit(db, request.user!.id, "PROJECT_CREATED", "project", projectId, input);
    response.status(201).json({ id: projectId, ...input });
  });

  router.get("/datasets", async (request, response) => {
    const projectId = typeof request.query.projectId === "string" ? request.query.projectId : null;
    const result = await db.query<Record<string, unknown>>(
      `SELECT d.*, p.name AS project_name
       FROM datasets d
       JOIN projects p ON p.id = d.project_id
       WHERE ($1::text IS NULL OR d.project_id = $1)
       ORDER BY d.created_at DESC`,
      [projectId]
    );
    response.json({ items: camelizeRows(result.rows) });
  });

  router.get("/experiments", async (request, response) => {
    const projectId = typeof request.query.projectId === "string" ? request.query.projectId : null;
    const result = await db.query<Record<string, unknown>>(
      `SELECT e.*, p.name AS project_name, u.name AS owner_name
       FROM experiments e
       JOIN projects p ON p.id = e.project_id
       JOIN users u ON u.id = e.owner_id
       WHERE ($1::text IS NULL OR e.project_id = $1)
       ORDER BY e.created_at DESC`,
      [projectId]
    );
    response.json({ items: camelizeRows(result.rows) });
  });

  router.post("/experiments", requireRole("ADMIN", "OPERATOR"), async (request: AuthenticatedRequest, response) => {
    const input = z.object({
      projectId: z.string().min(1),
      name: z.string().min(3).max(100)
    }).parse(request.body);
    const experimentId = id("exp");
    await db.query(
      `INSERT INTO experiments
        (id, project_id, name, owner_id, status, run_count, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 0, CURRENT_TIMESTAMP)`,
      [experimentId, input.projectId, input.name, request.user!.id]
    );
    await writeAudit(db, request.user!.id, "EXPERIMENT_CREATED", "experiment", experimentId, input);
    response.status(201).json({ id: experimentId, ...input, status: "ACTIVE", runCount: 0 });
  });

  router.get("/models", async (request, response) => {
    const projectId = typeof request.query.projectId === "string" ? request.query.projectId : null;
    const result = await db.query<Record<string, unknown>>(
      `SELECT m.*, p.name AS project_name
       FROM models m
       JOIN projects p ON p.id = m.project_id
       WHERE ($1::text IS NULL OR m.project_id = $1)
       ORDER BY
         CASE m.stage WHEN 'PRODUCTION' THEN 1 WHEN 'STAGING' THEN 2 ELSE 3 END,
         m.created_at DESC`,
      [projectId]
    );
    response.json({ items: camelizeRows(result.rows) });
  });

  return router;
}
