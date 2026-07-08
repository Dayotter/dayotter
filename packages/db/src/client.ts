import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString?: string) {
  // The pool connects lazily on first query, so constructing it without a URL is
  // safe (e.g. during `next build`, which must not require a live database).
  const pool = new Pool(connectionString ? { connectionString } : {});
  return drizzle(pool, { schema, casing: "snake_case" });
}

/**
 * Shared singleton for app processes. Reuses one pool across hot reloads in dev.
 */
const globalForDb = globalThis as unknown as { __calsyncDb?: Database };

export function getDb(): Database {
  if (!globalForDb.__calsyncDb) {
    if (!process.env.DATABASE_URL) {
      console.warn("[db] DATABASE_URL is not set — queries will fail until it is configured");
    }
    globalForDb.__calsyncDb = createDatabase(process.env.DATABASE_URL);
  }
  return globalForDb.__calsyncDb;
}
