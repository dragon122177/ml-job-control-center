import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type AppContext } from "./app.js";

describe("ML Job Control Center API", () => {
  let context: AppContext;
  let adminToken: string;
  let viewerToken: string;
  let createdJobId: string;

  beforeAll(async () => {
    context = await createApp({ startScheduler: false, quiet: true });

    const admin = await request(context.app)
      .post("/api/auth/login")
      .send({ email: "admin@mlcontrol.demo", password: "demo1234" });
    adminToken = admin.body.token;

    const viewer = await request(context.app)
      .post("/api/auth/login")
      .send({ email: "viewer@mlcontrol.demo", password: "demo1234" });
    viewerToken = viewer.body.token;
  });

  afterAll(async () => {
    await context.close();
  });

  it("reports service health without authentication", async () => {
    const response = await request(context.app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "ml-job-control-center-api",
      database: "embedded"
    });
  });

  it("rejects invalid login credentials", async () => {
    const response = await request(context.app)
      .post("/api/auth/login")
      .send({ email: "admin@mlcontrol.demo", password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns an operational dashboard", async () => {
    const response = await request(context.app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.metrics.projects).toBe(3);
    expect(response.body.recentJobs.length).toBeGreaterThan(0);
  });

  it("returns all portfolio catalogs and the filterable job queue", async () => {
    const paths = [
      "/api/catalog/projects",
      "/api/catalog/datasets",
      "/api/catalog/experiments",
      "/api/catalog/models",
      "/api/jobs?status=RUNNING&search=defect"
    ];
    for (const path of paths) {
      const response = await request(context.app)
        .get(path)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
    }
  });

  it("prevents viewers from creating workloads", async () => {
    const response = await request(context.app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        projectId: "prj_vision",
        name: "forbidden-viewer-job",
        type: "TRAINING",
        framework: "PyTorch"
      });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("creates a validated training workload", async () => {
    const response = await request(context.app)
      .post("/api/jobs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        projectId: "prj_vision",
        experimentId: "exp_yolo",
        datasetId: "dts_images_v8",
        name: "integration-training-run",
        type: "TRAINING",
        priority: "HIGH",
        framework: "PyTorch",
        requestedGpu: 1,
        requestedCpu: 8,
        requestedMemoryGb: 24,
        maxRetries: 2,
        config: { epochs: 25 }
      });
    expect(response.status).toBe(202);
    expect(response.body.status).toBe("QUEUED");
    expect(response.body.config).toEqual({ epochs: 25 });
    createdJobId = response.body.id;
  });

  it("assigns queued jobs when the scheduler advances", async () => {
    await context.runner.tick();
    const response = await request(context.app)
      .get(`/api/jobs/${createdJobId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(["RUNNING", "QUEUED"]).toContain(response.body.status);
    expect(response.body.events.length).toBeGreaterThan(0);
  });

  it("cancels an active workload and records the event", async () => {
    const response = await request(context.app)
      .post(`/api/jobs/${createdJobId}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(202);
    expect(response.body.status).toBe("CANCELLED");

    const detail = await request(context.app)
      .get(`/api/jobs/${createdJobId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(detail.body.events.some((event: { event: string }) => event.event === "JOB_CANCELLED"))
      .toBe(true);
  });

  it("requeues a cancelled workload within its retry policy", async () => {
    const response = await request(context.app)
      .post(`/api/jobs/${createdJobId}/retry`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(202);
    expect(response.body.status).toBe("QUEUED");
  });

  it("returns worker capacity and system diagnostics", async () => {
    const [workers, system] = await Promise.all([
      request(context.app).get("/api/operations/workers").set("Authorization", `Bearer ${adminToken}`),
      request(context.app).get("/api/operations/system").set("Authorization", `Bearer ${adminToken}`)
    ]);
    expect(workers.status).toBe(200);
    expect(workers.body.items.length).toBe(5);
    expect(system.body.database.connected).toBe(true);
  });

  it("restricts the audit trail to administrators", async () => {
    const denied = await request(context.app)
      .get("/api/operations/audit")
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(denied.status).toBe(403);

    const allowed = await request(context.app)
      .get("/api/operations/audit")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.items.length).toBeGreaterThan(0);
  });
});
