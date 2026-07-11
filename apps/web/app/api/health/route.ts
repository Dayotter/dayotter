import { getDb, sql } from "@dayotter/db";
import { pingRedis, readHeartbeat } from "@dayotter/jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Worker is considered alive if it wrote a heartbeat in the last 2 minutes. */
const WORKER_STALE_MS = 120_000;

async function checkDb(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Readiness probe: verifies the app can actually reach its dependencies. Returns
 * 503 when the DB or Redis is unreachable so load balancers / uptime monitors
 * stop routing to a broken instance. `worker` is informational (a stale worker
 * doesn't fail web readiness, but it's visible).
 */
export async function GET() {
  const [db, redis, heartbeat] = await Promise.all([checkDb(), pingRedis(), readHeartbeat()]);
  const worker = heartbeat !== null && Date.now() - heartbeat < WORKER_STALE_MS ? "alive" : "stale";
  const ready = db && redis;

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      service: "dayotter-web",
      db,
      redis,
      worker,
      time: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
