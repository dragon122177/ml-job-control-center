import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import rateLimit from "express-rate-limit";
import pino from "pino";
import type { Database } from "./db.js";
import { createDatabase } from "./db.js";
import { initializeSchema } from "./schema.js";
import { seedDatabase } from "./seed.js";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth-routes.js";
import { dashboardRoutes } from "./routes/dashboard-routes.js";
import { catalogRoutes } from "./routes/catalog-routes.js";
import { jobRoutes } from "./routes/job-routes.js";
import { operationsRoutes } from "./routes/operations-routes.js";
import { requireAuth } from "./auth.js";
import { errorHandler, notFound } from "./errors.js";
import { RealtimeBus } from "./realtime.js";
import { JobRunner } from "./job-runner.js";

export type AppContext = {
  app: Express;
  db: Database;
  bus: RealtimeBus;
  runner: JobRunner;
  close(): Promise<void>;
};

type AppOptions = {
  database?: Database;
  startScheduler?: boolean;
  quiet?: boolean;
};

export async function createApp(options: AppOptions = {}): Promise<AppContext> {
  const db = options.database ?? await createDatabase(config.databaseUrl);
  await initializeSchema(db);
  await seedDatabase(db);

  const bus = new RealtimeBus();
  const runner = new JobRunner(db, bus, config.schedulerTickMs);
  if (options.startScheduler ?? config.schedulerEnabled) runner.start();

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({
    origin: config.webOrigin,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "OPTIONS"]
  }));
  app.use(express.json({ limit: "256kb" }));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 500,
    standardHeaders: "draft-8",
    legacyHeaders: false
  }));

  if (!options.quiet) {
    app.use(pinoHttp({
      logger: pino({ level: config.logLevel }),
      autoLogging: {
        ignore: (request: { url?: string }) => request.url === "/api/health"
      },
      redact: ["req.headers.authorization"]
    }));
  }

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "ml-job-control-center-api",
      database: db.mode,
      time: new Date().toISOString()
    });
  });
  app.use("/api/auth", authRoutes(db));

  app.get("/api/events", requireAuth, (request, response) => {
    const disconnect = bus.connect(response);
    request.on("close", disconnect);
  });

  app.use("/api", requireAuth);
  app.use("/api/dashboard", dashboardRoutes(db));
  app.use("/api/jobs", jobRoutes(db, bus));
  app.use("/api/catalog", catalogRoutes(db));
  app.use("/api/operations", operationsRoutes(db, bus));

  app.use(notFound);
  app.use(errorHandler);

  return {
    app,
    db,
    bus,
    runner,
    async close() {
      runner.stop();
      bus.close();
      await db.close();
    }
  };
}
