import pg from "pg";
import { newDb } from "pg-mem";
import type { QueryResult, QueryResultRow } from "pg";

export interface Database {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<R>>;
  close(): Promise<void>;
  mode: "embedded" | "postgres";
}

export async function createDatabase(databaseUrl?: string): Promise<Database> {
  if (databaseUrl) {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined
    });

    return {
      query: (text, values) => pool.query(text, values),
      close: () => pool.end(),
      mode: "postgres"
    };
  }

  const memory = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();

  return {
    query: (text, values) => pool.query(text, values),
    close: () => pool.end(),
    mode: "embedded"
  };
}
