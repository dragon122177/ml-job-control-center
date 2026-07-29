import type { Database } from "./db.js";
import { id, safeJson } from "./utils.js";

export async function writeAudit(
  db: Database,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: unknown = {}
): Promise<void> {
  await db.query(
    `INSERT INTO audit_events
      (id, actor_id, action, entity_type, entity_id, metadata_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [id("aud"), actorId, action, entityType, entityId, safeJson(metadata)]
  );
}
