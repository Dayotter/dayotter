import { DEFAULT_REMINDER_OFFSETS, logger } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
import { cancelReminder, scheduleReminder } from "@calsync/jobs";

/**
 * The reminder lead times (minutes before the event) to use for a host — their
 * saved preference, or the product default. This is the wiring that makes the
 * Preferences → "Default reminders" setting actually affect bookings.
 */
export async function reminderOffsetsForHost(userId: string): Promise<number[]> {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
    columns: { defaultReminderOffsets: true },
  });
  const offsets = prefs?.defaultReminderOffsets;
  return offsets && offsets.length > 0 ? offsets : [...DEFAULT_REMINDER_OFFSETS];
}

/** Cancel pending reminder jobs and delete the rows for a booking. */
export async function clearBookingReminders(bookingId: string): Promise<void> {
  const db = getDb();
  const existing = await db.query.scheduledReminders.findMany({
    where: eq(schema.scheduledReminders.bookingId, bookingId),
  });
  await Promise.all(
    existing.filter((r) => !r.sentAt).map((r) => cancelReminder(r.id).catch(() => {})),
  );
  await db
    .delete(schema.scheduledReminders)
    .where(eq(schema.scheduledReminders.bookingId, bookingId));
}

/**
 * Schedule reminder jobs at each offset before `start` (past times skipped).
 * Persists a `scheduledReminders` row and enqueues a durable BullMQ job per
 * reminder. Shared by the create and reschedule flows.
 */
export async function scheduleBookingReminders(
  bookingId: string,
  start: Date,
  offsets: number[],
): Promise<void> {
  const db = getDb();
  const fireTimes = offsets
    .map((o) => new Date(start.getTime() - o * 60_000))
    .filter((d) => d.getTime() > Date.now());

  await Promise.all(
    fireTimes.map(async (fireAt) => {
      const [rem] = await db
        .insert(schema.scheduledReminders)
        .values({ bookingId, scheduledFor: fireAt })
        .returning();
      if (!rem) return;
      try {
        await scheduleReminder({ reminderId: rem.id, bookingId }, fireAt);
      } catch (err) {
        logger.error("failed to enqueue reminder", { event: "reminder_enqueue_failed", bookingId, err });
      }
    }),
  );
}

/** Schedule a post-meeting follow-up email `offsetMinutes` after the meeting ends. */
export async function scheduleBookingFollowUp(
  bookingId: string,
  endsAt: Date,
  offsetMinutes: number,
): Promise<void> {
  const fireAt = new Date(endsAt.getTime() + offsetMinutes * 60_000);
  const db = getDb();
  const [rem] = await db
    .insert(schema.scheduledReminders)
    .values({ bookingId, kind: "followup", scheduledFor: fireAt })
    .returning();
  if (!rem) return;
  try {
    await scheduleReminder({ reminderId: rem.id, bookingId }, fireAt);
  } catch (err) {
    logger.error("failed to enqueue follow-up", {
      event: "followup_enqueue_failed",
      bookingId,
      err,
    });
  }
}
