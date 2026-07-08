import { randomUUID } from "node:crypto";
import type { CalendarAdapter } from "@calsync/calendar";
import { logger } from "@calsync/core";
import { and, eq, getDb, inArray, schema, sql } from "@calsync/db";
import { adapterForConnection } from "@calsync/integrations";
import { connection, QUEUE_NAMES, type SyncJob } from "@calsync/jobs";
import { Worker } from "bullmq";

/** Rolling window we keep the free/busy cache warm for. */
const SYNC_WINDOW_DAYS = 90;

type CalendarRow = typeof schema.calendars.$inferSelect;

/**
 * Incrementally syncs a connection's calendars: pulls changes since the stored
 * cursor (Google syncToken / MS deltaLink / CalDAV poll), upserts/deletes the
 * cached busy blocks per calendar, advances the cursor, and keeps a push
 * subscription alive. The availability engine reads only from this cache.
 */
export function startSyncWorker(): Worker<SyncJob> {
  return new Worker<SyncJob>(
    QUEUE_NAMES.sync,
    async (job) => {
      const db = getDb();
      const conn = await db.query.calendarConnections.findFirst({
        where: eq(schema.calendarConnections.id, job.data.connectionId),
        with: { calendars: true },
      });
      if (!conn) return;

      const calendars = conn.calendars.filter(
        (c) => c.checkForConflicts && (!job.data.calendarId || c.id === job.data.calendarId),
      );
      if (calendars.length === 0) return;

      const windowStart = new Date();
      const windowEnd = new Date(Date.now() + SYNC_WINDOW_DAYS * 86_400_000);

      try {
        const adapter = await adapterForConnection(conn);
        for (const cal of calendars) {
          await syncCalendar(adapter, cal, windowStart, windowEnd);
          await ensureSubscription(adapter, cal, conn.provider);
        }
        await db
          .update(schema.calendarConnections)
          .set({ lastSyncedAt: new Date(), status: "active", lastError: null })
          .where(eq(schema.calendarConnections.id, conn.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("calendar sync failed", {
          event: "sync_failed",
          connectionId: conn.id,
          provider: conn.provider,
          reason: job.data.reason,
          err,
        });
        await db
          .update(schema.calendarConnections)
          .set({ status: "error", lastError: message })
          .where(eq(schema.calendarConnections.id, conn.id));
        throw err;
      }
    },
    { connection, concurrency: 5 },
  );
}

/** Apply one calendar's incremental changes to the busy_blocks cache. */
async function syncCalendar(
  adapter: CalendarAdapter,
  cal: CalendarRow,
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  const db = getDb();
  let result = await adapter.syncEvents(cal.externalId, cal.syncToken, windowStart, windowEnd);

  // Cursor invalidated (or CalDAV poll) → wipe this calendar's cache + full resync.
  if (result.fullResync) {
    await db.delete(schema.busyBlocks).where(eq(schema.busyBlocks.calendarId, cal.id));
    if (cal.syncToken) {
      result = await adapter.syncEvents(cal.externalId, null, windowStart, windowEnd);
    }
  }

  if (result.deletedExternalIds.length > 0) {
    await db
      .delete(schema.busyBlocks)
      .where(
        and(
          eq(schema.busyBlocks.calendarId, cal.id),
          inArray(schema.busyBlocks.externalEventId, result.deletedExternalIds),
        ),
      );
  }

  if (result.busy.length > 0) {
    await db
      .insert(schema.busyBlocks)
      .values(
        result.busy.map((b) => ({
          calendarId: cal.id,
          externalEventId: b.externalEventId,
          startsAt: b.start,
          endsAt: b.end,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.busyBlocks.calendarId, schema.busyBlocks.externalEventId],
        set: { startsAt: sql`excluded.starts_at`, endsAt: sql`excluded.ends_at` },
      });
  }

  if (result.nextCursor !== undefined) {
    await db
      .update(schema.calendars)
      .set({ syncToken: result.nextCursor })
      .where(eq(schema.calendars.id, cal.id));
  }
}

/**
 * Keep a live push subscription for the calendar (Google watch / MS Graph
 * subscription). No-op for CalDAV (no webhooks) and when APP_URL isn't a public
 * https endpoint (local dev — the provider couldn't reach us anyway).
 */
async function ensureSubscription(
  adapter: CalendarAdapter,
  cal: CalendarRow,
  provider: string,
): Promise<void> {
  if (!adapter.watch) return;
  const appUrl = process.env.APP_URL ?? "";
  if (!appUrl.startsWith("https://")) return;

  const db = getDb();
  const existing = await db.query.webhookSubscriptions.findFirst({
    where: eq(schema.webhookSubscriptions.calendarId, cal.id),
  });
  // Still valid for > 1h → nothing to do.
  if (existing && existing.expiresAt.getTime() > Date.now() + 3_600_000) return;

  const clientState = randomUUID();
  const result = await adapter.watch(
    cal.externalId,
    `${appUrl}/api/webhooks/${provider}`,
    clientState,
  );
  if (!result) return;

  if (existing) {
    await db
      .delete(schema.webhookSubscriptions)
      .where(eq(schema.webhookSubscriptions.id, existing.id));
  }
  await db.insert(schema.webhookSubscriptions).values({
    calendarId: cal.id,
    externalId: result.externalId,
    expiresAt: result.expiresAt,
    metadata: { ...result.metadata, clientState, resourceId: result.resourceId ?? null },
  });
}
