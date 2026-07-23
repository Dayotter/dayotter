import { DEFAULT_REMINDER_OFFSETS, logger } from "@dayotter/core";
import { and, eq, getDb, inArray, schema } from "@dayotter/db";
import { cancelReminder, scheduleReminder } from "@dayotter/jobs";

/**
 * The reminder lead times (minutes before the event) to use for a host - their
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
        logger.error("failed to enqueue reminder", {
          event: "reminder_enqueue_failed",
          bookingId,
          err,
        });
      }
    }),
  );
}

/**
 * Schedule the host's active workflow messages for a booking. A workflow applies
 * when it has no event-type mapping (all events) or is mapped to this event type.
 * `before_event` fires `offset` minutes before the start; `after_event` fires
 * `offset` minutes after the end. Past fire times are skipped. Each scheduled
 * message records its `workflowId` so the worker renders the host's template.
 */
export async function scheduleWorkflowMessages(
  bookingId: string,
  organizationId: string,
  eventTypeId: string | null,
  start: Date,
  end: Date,
): Promise<void> {
  const db = getDb();
  const workflows = await db.query.workflows.findMany({
    where: and(
      eq(schema.workflows.organizationId, organizationId),
      eq(schema.workflows.isActive, true),
      inArray(schema.workflows.trigger, ["before_event", "after_event"]),
    ),
    columns: { id: true, trigger: true, offsetMinutes: true },
  });
  if (workflows.length === 0) return;

  // Map each workflow to its event-type scoping (absent = applies to all).
  const maps = await db.query.workflowEventTypes.findMany({
    where: inArray(
      schema.workflowEventTypes.workflowId,
      workflows.map((w) => w.id),
    ),
    columns: { workflowId: true, eventTypeId: true },
  });
  const scoped = new Map<string, Set<string>>();
  for (const m of maps) {
    if (!scoped.has(m.workflowId)) scoped.set(m.workflowId, new Set());
    scoped.get(m.workflowId)!.add(m.eventTypeId);
  }

  const applicable = workflows.filter((w) => {
    const set = scoped.get(w.id);
    if (!set) return true; // no mapping → all event types
    return eventTypeId != null && set.has(eventTypeId);
  });

  await Promise.all(
    applicable.map(async (w) => {
      const fireAt =
        w.trigger === "after_event"
          ? new Date(end.getTime() + w.offsetMinutes * 60_000)
          : new Date(start.getTime() - w.offsetMinutes * 60_000);
      if (fireAt.getTime() <= Date.now()) return; // already past

      const [rem] = await db
        .insert(schema.scheduledReminders)
        .values({
          bookingId,
          workflowId: w.id,
          kind: w.trigger === "after_event" ? "followup" : "reminder",
          scheduledFor: fireAt,
        })
        .returning();
      if (!rem) return;
      try {
        await scheduleReminder({ reminderId: rem.id, bookingId }, fireAt);
      } catch (err) {
        logger.error("failed to enqueue workflow message", {
          event: "workflow_enqueue_failed",
          bookingId,
          workflowId: w.id,
          err,
        });
      }
    }),
  );
}

/**
 * Proactive overflow guard (#1): schedule a check at the meeting's scheduled END
 * so that - if a back-to-back meeting follows - the host's next attendees get a
 * "running a few minutes behind" heads-up automatically, the way an EA would.
 * The worker re-checks the host's opt-in and whether a next meeting actually
 * exists at fire time, so this is safe to schedule for every booking.
 */
export async function scheduleOverflowCheck(bookingId: string, endsAt: Date): Promise<void> {
  if (endsAt.getTime() <= Date.now()) return;
  const db = getDb();
  const [rem] = await db
    .insert(schema.scheduledReminders)
    .values({ bookingId, kind: "overflow", scheduledFor: endsAt })
    .returning();
  if (!rem) return;
  try {
    await scheduleReminder({ reminderId: rem.id, bookingId }, endsAt);
  } catch (err) {
    logger.error("failed to enqueue overflow check", {
      event: "overflow_enqueue_failed",
      bookingId,
      err,
    });
  }
}

/** Whether the host has opted into proactive overflow notices. */
export async function hostWantsOverflowNotice(userId: string): Promise<boolean> {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
    columns: { overflowNotifyEnabled: true },
  });
  return prefs?.overflowNotifyEnabled ?? false;
}

export interface HostBookingPrefs {
  wantsOverflow: boolean;
  wantsScribe: boolean;
  reminderOffsets: number[];
}

/**
 * The host preferences the booking-finalize path needs, in ONE read instead of
 * three separate `userPreferences` lookups for the same row.
 */
export async function hostBookingPrefs(userId: string): Promise<HostBookingPrefs> {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
    columns: {
      overflowNotifyEnabled: true,
      scribeEnabled: true,
      defaultReminderOffsets: true,
    },
  });
  const offsets = prefs?.defaultReminderOffsets;
  return {
    wantsOverflow: prefs?.overflowNotifyEnabled ?? false,
    wantsScribe: prefs?.scribeEnabled ?? false,
    reminderOffsets: offsets && offsets.length > 0 ? offsets : [...DEFAULT_REMINDER_OFFSETS],
  };
}

/** Whether the host has opted into the post-meeting recap ("Scribe"). */
export async function hostWantsScribe(userId: string): Promise<boolean> {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
    columns: { scribeEnabled: true },
  });
  return prefs?.scribeEnabled ?? false;
}

/**
 * Post-meeting recap ("Scribe"): schedule a check shortly after the meeting ends
 * that sends the host a recap + next-step nudges. The worker re-checks the
 * booking wasn't cancelled at fire time, so it's safe to schedule at create.
 */
export async function scheduleScribe(bookingId: string, endsAt: Date): Promise<void> {
  const fireAt = new Date(endsAt.getTime() + 2 * 60_000);
  if (fireAt.getTime() <= Date.now()) return;
  const db = getDb();
  const [rem] = await db
    .insert(schema.scheduledReminders)
    .values({ bookingId, kind: "scribe", scheduledFor: fireAt })
    .returning();
  if (!rem) return;
  try {
    await scheduleReminder({ reminderId: rem.id, bookingId }, fireAt);
  } catch (err) {
    logger.error("failed to enqueue scribe", { event: "scribe_enqueue_failed", bookingId, err });
  }
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
