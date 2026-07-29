import type { Response } from "express";
import type { JobEventPayload } from "./types.js";

export class RealtimeBus {
  private clients = new Set<Response>();

  connect(response: Response): () => void {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    response.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    this.clients.add(response);

    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 20_000);
    return () => {
      clearInterval(heartbeat);
      this.clients.delete(response);
    };
  }

  publish(payload: JobEventPayload): void {
    const message = `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) client.write(message);
  }

  close(): void {
    for (const client of this.clients) client.end();
    this.clients.clear();
  }
}
