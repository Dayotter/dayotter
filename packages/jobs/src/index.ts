import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Shared queue definitions + producers. Both the web app (producer) and the
 * worker (consumer) import from here so neither depends on the other.
 */

export const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAMES = {
  reminders: "reminders",
  sync: "calendar-sync",
  maintenance: "calendar-maintenance",
  webhooks: "webhooks",
} as const;

/** Liveness key the worker refreshes so the web /health can confirm it's alive. */
export const WORKER_HEARTBEAT_KEY = "calsync:worker:heartbeat";

/** Worker: record that it's alive (short TTL so a dead worker goes stale fast). */
export async function writeHeartbeat(): Promise<void> {
  await connection.set(WORKER_HEARTBEAT_KEY, String(Date.now()), "EX", 120);
}

/** Web: last worker heartbeat epoch-ms, or null if none/expired. */
export async function readHeartbeat(): Promise<number | null> {
  const v = await connection.get(WORKER_HEARTBEAT_KEY);
  return v ? Number(v) : null;
}

/** Is Redis reachable? Used by health checks; never throws. */
export async function pingRedis(): Promise<boolean> {
  try {
    return (await connection.ping()) === "PONG";
  } catch {
    return false;
  }
}

/** Pending/active/failed counts per queue, for health/metrics. */
export async function queueDepths(): Promise<
  Record<string, Awaited<ReturnType<Queue["getJobCounts"]>>>
> {
  const [reminders, sync, maintenance] = await Promise.all([
    remindersQueue.getJobCounts(),
    syncQueue.getJobCounts(),
    maintenanceQueue.getJobCounts(),
  ]);
  return { reminders, sync, maintenance };
}

export interface ReminderJob {
  reminderId: string;
  bookingId: string;
}

export interface SyncJob {
  connectionId: string;
  /** Optional single calendar to sync; otherwise all in the connection. */
  calendarId?: string;
  reason: "webhook" | "poll" | "initial" | "renewal";
}

export interface WebhookJob {
  deliveryId: string;
}

export const remindersQueue = new Queue<ReminderJob>(QUEUE_NAMES.reminders, { connection });
export const syncQueue = new Queue<SyncJob>(QUEUE_NAMES.sync, { connection });
export const maintenanceQueue = new Queue(QUEUE_NAMES.maintenance, { connection });
export const webhooksQueue = new Queue<WebhookJob>(QUEUE_NAMES.webhooks, { connection });

/**
 * Enqueue delivery of a persisted webhook delivery row. Retries with backoff so
 * a flaky consumer endpoint recovers without losing events; the delivery row
 * records the terminal status either way.
 */
export async function enqueueWebhook(deliveryId: string): Promise<void> {
  await webhooksQueue.add(
    "deliver",
    { deliveryId },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 200,
    },
  );
}

/**
 * Register the repeatable maintenance tick. It polls webhook-less providers
 * (Apple/CalDAV), renews expiring push subscriptions, and reconciles anything a
 * missed webhook left stale. Idempotent (fixed jobId).
 */
export async function scheduleMaintenance(everyMs = 15 * 60_000): Promise<void> {
  await maintenanceQueue.add(
    "tick",
    {},
    {
      repeat: { every: everyMs },
      jobId: "maintenance-tick",
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
}

/**
 * Schedule a reminder to fire at an absolute time. Idempotent per reminderId,
 * so re-enqueuing (e.g. after a reschedule) replaces the pending job cleanly.
 */
export async function scheduleReminder(job: ReminderJob, fireAt: Date): Promise<string> {
  const delay = Math.max(0, fireAt.getTime() - Date.now());
  // BullMQ custom job ids may not contain ":".
  const jobId = `reminder-${job.reminderId}`;
  await remindersQueue.remove(jobId).catch(() => {});
  await remindersQueue.add("send", job, {
    jobId,
    delay,
    removeOnComplete: true,
    removeOnFail: 100,
  });
  return jobId;
}

export async function cancelReminder(reminderId: string): Promise<void> {
  await remindersQueue.remove(`reminder-${reminderId}`).catch(() => {});
}

/**
 * Fixed-window rate limiter backed by the shared Redis connection. Atomic
 * INCR+EXPIRE via a Lua script so concurrent requests can't race the window
 * reset. Fails OPEN (allows the request) if Redis is unreachable — a rate
 * limiter should never take down the booking flow.
 */
const RATE_LIMIT_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {n, redis.call('TTL', KEYS[1])}
`;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  resetSec: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const [count, ttl] = (await connection.eval(
      RATE_LIMIT_LUA,
      1,
      `rl:${key}`,
      String(windowSec),
    )) as [number, number];
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSec: ttl < 0 ? windowSec : ttl,
    };
  } catch {
    return { ok: true, remaining: limit, resetSec: 0 };
  }
}

/**
 * Enqueue a calendar sync. Jobs are keyed per calendar (or connection) so a
 * burst of duplicate webhooks coalesces into a single pending job instead of
 * amplifying into thousands — BullMQ ignores an add whose jobId is already
 * waiting. Incremental syncs are cursor-based, so a coalesced run still catches
 * every change; the maintenance poll backstops anything missed.
 */
export async function enqueueSync(job: SyncJob): Promise<void> {
  const jobId = `sync-${job.calendarId ?? job.connectionId}`;
  await syncQueue.add(job.reason, job, {
    jobId,
    removeOnComplete: true,
    removeOnFail: 100,
  });
}
