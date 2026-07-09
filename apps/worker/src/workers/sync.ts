import { randomUUID } from "node:crypto";
import type { CalendarAdapter } from "@calsync/calendar";
import { logger } from "@calsync/core";
import { and, eq, getDb, inArray, schema, sql } from "@calsync/db";
import { adapterForConnection } from "@calsync/integrations";
import { QUEUE_NAMES, type SyncJob, connection } from "@calsync/jobs";
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

/**
 * Apply one calendar's incremental changes. `calendar_events` is the rich source
 * of truth; `busy_blocks` is its lean availability projection (opaque, non-all-day
 * events only). Both are written from the same adapter output in one pass, so
 * they can't drift.
 */
async function syncCalendar(
  adapter: CalendarAdapter,
  cal: CalendarRow,
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  const db = getDb();
  let result = await adapter.syncEvents(cal.externalId, cal.syncToken, windowStart, windowEnd);

  // Cursor invalidated (or CalDAV poll) → wipe this calendar's caches + full resync.
  if (result.fullResync) {
    await db.delete(schema.busyBlocks).where(eq(schema.busyBlocks.calendarId, cal.id));
    await db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.calendarId, cal.id));
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
    await db
      .delete(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.calendarId, cal.id),
          inArray(schema.calendarEvents.externalEventId, result.deletedExternalIds),
        ),
      );
  }

  if (result.events.length > 0) {
    // Rich unified event model.
    await db
      .insert(schema.calendarEvents)
      .values(
        result.events.map((e) => ({
          calendarId: cal.id,
          externalEventId: e.externalEventId,
          title: e.title,
          description: e.description,
          startsAt: e.start,
          endsAt: e.end,
          allDay: e.allDay ?? false,
          timezone: e.timezone,
          location: e.location,
          meetingUrl: e.meetingUrl,
          organizerEmail: e.organizer?.email,
          organizerName: e.organizer?.name,
          attendees: e.attendees,
          status: e.status ?? "confirmed",
          visibility: e.visibility ?? "default",
          transparency: e.transparency ?? "opaque",
          recurringEventId: e.recurringEventId,
          isRecurring: e.isRecurring ?? false,
          syncedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [schema.calendarEvents.calendarId, schema.calendarEvents.externalEventId],
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          startsAt: sql`excluded.starts_at`,
          endsAt: sql`excluded.ends_at`,
          allDay: sql`excluded.all_day`,
          timezone: sql`excluded.timezone`,
          location: sql`excluded.location`,
          meetingUrl: sql`excluded.meeting_url`,
          organizerEmail: sql`excluded.organizer_email`,
          organizerName: sql`excluded.organizer_name`,
          attendees: sql`excluded.attendees`,
          status: sql`excluded.status`,
          visibility: sql`excluded.visibility`,
          transparency: sql`excluded.transparency`,
          recurringEventId: sql`excluded.recurring_event_id`,
          isRecurring: sql`excluded.is_recurring`,
          syncedAt: sql`excluded.synced_at`,
        },
      });

    // Availability projection: opaque (time-blocking) events. Transparent events
    // (free / most all-day reminders) don't block. All-day opaque events (e.g.
    // vacation) still block, matching prior behavior.
    const busy = result.events.filter((e) => e.transparency !== "transparent");
    if (busy.length > 0) {
      await db
        .insert(schema.busyBlocks)
        .values(
          busy.map((b) => ({
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
    // Events that flipped to transparent/all-day shouldn't linger as busy.
    const freed = result.events
      .filter((e) => e.transparency === "transparent" || e.allDay)
      .map((e) => e.externalEventId);
    if (freed.length > 0) {
      await db
        .delete(schema.busyBlocks)
        .where(
          and(
            eq(schema.busyBlocks.calendarId, cal.id),
            inArray(schema.busyBlocks.externalEventId, freed),
          ),
        );
    }
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
