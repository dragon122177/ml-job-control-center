import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";

const context = await createApp();
const server = createServer(context.app);

server.listen(config.port, () => {
  console.log(`ML Control Center API listening on http://localhost:${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await context.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
