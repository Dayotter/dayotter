import { and, eq, getDb, isNull, schema } from "@calsync/db";
import { bookingReminder, sendEmail } from "@calsync/emails";
import { QUEUE_NAMES, type ReminderJob, connection } from "@calsync/jobs";
import { deliverUserReminder } from "@calsync/notifications";
import { Worker } from "bullmq";
import { DateTime } from "luxon";

/** Human label for how far out the meeting is, e.g. "in about 1 hour". */
function leadLabel(start: Date): string {
  const mins = Math.round((start.getTime() - Date.now()) / 60_000);
  if (mins >= 720) return "tomorrow";
  if (mins >= 90) return `in about ${Math.round(mins / 60)} hours`;
  if (mins >= 45) return "in about 1 hour";
  return "soon";
}

/**
 * Sends a reminder email for a booking. Idempotent: if the reminder row is
 * already marked sent, it no-ops, so a duplicate job delivery won't double-send.
 */
export function startRemindersWorker(): Worker<ReminderJob> {
  return new Worker<ReminderJob>(
    QUEUE_NAMES.reminders,
    async (job) => {
      const db = getDb();
      const reminder = await db.query.scheduledReminders.findFirst({
        where: and(
          eq(schema.scheduledReminders.id, job.data.reminderId),
          isNull(schema.scheduledReminders.sentAt),
        ),
      });
      if (!reminder) return; // already sent or cancelled

      const booking = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, job.data.bookingId),
        with: { attendees: true, host: true },
      });
      if (!booking || booking.status !== "confirmed") return;

      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const label = leadLabel(booking.startsAt);

      await Promise.all(
        booking.attendees.map((a) =>
          sendEmail({
            ...bookingReminder({
              eventTitle: booking.title,
              start: booking.startsAt,
              end: booking.endsAt,
              timezone: a.timezone ?? booking.timezone,
              hostName: booking.host?.name ?? "your host",
              attendeeName: a.name ?? a.email,
              meetingUrl: booking.meetingUrl ?? undefined,
              location: booking.location ?? undefined,
              manageUrl: `${appUrl}/booking/${booking.uid}`,
              leadLabel: label,
            }),
            to: a.email,
          }),
        ),
      );

      // Also nudge the host on any extra channels they configured (Slack /
      // WhatsApp / push). Best-effort — never blocks the attendee emails above.
      if (booking.hostId) {
        const when = DateTime.fromJSDate(booking.startsAt)
          .setZone(booking.host?.timezone ?? booking.timezone)
          .toFormat("ccc, LLL d 'at' h:mm a");
        await deliverUserReminder(booking.hostId, {
          title: `Upcoming: ${booking.title}`,
          body: `Starts ${label} — ${when}.`,
          url: `${appUrl}/booking/${booking.uid}`,
        }).catch(() => 0);
      }

      await db
        .update(schema.scheduledReminders)
        .set({ sentAt: new Date() })
        .where(eq(schema.scheduledReminders.id, reminder.id));
    },
    { connection, concurrency: 10 },
  );
}
