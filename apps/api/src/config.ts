import "dotenv/config";

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: numberFromEnv(process.env.PORT, 4100),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "development-only-secret-change-me",
  databaseUrl: process.env.DATABASE_URL,
  schedulerTickMs: numberFromEnv(process.env.SCHEDULER_TICK_MS, 900),
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== "false",
  logLevel: process.env.LOG_LEVEL ?? "info",
  isProduction: process.env.NODE_ENV === "production"
};
