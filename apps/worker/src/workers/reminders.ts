import { and, asc, eq, getDb, gt, isNull, lt, schema } from "@dayotter/db";
import {
  bookingFollowUp,
  bookingNoShowFollowUp,
  bookingReminder,
  bookingRunningLate,
  meetingRecap,
  sendEmail,
  workflowEmail,
} from "@dayotter/emails";
import { QUEUE_NAMES, type ReminderJob, connection } from "@dayotter/jobs";
import { deliverUserReminder } from "@dayotter/notifications";
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
      if (!booking) return;
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";

      // Host-authored workflow message - render the workflow's own template.
      // "reminder" (before_event) sends only for a still-confirmed booking;
      // "followup" (after_event) sends unless the booking was cancelled/rejected.
      if (reminder.workflowId) {
        const workflow = await db.query.workflows.findFirst({
          where: eq(schema.workflows.id, reminder.workflowId),
        });
        const beforeEvent = reminder.kind !== "followup";
        const gate = beforeEvent
          ? booking.status === "confirmed"
          : booking.status !== "cancelled" && booking.status !== "rejected";
        if (workflow?.isActive && workflow.action === "email" && gate) {
          await Promise.all(
            booking.attendees.map((a) =>
              sendEmail({
                ...workflowEmail({
                  eventTitle: booking.title,
                  start: booking.startsAt,
                  end: booking.endsAt,
                  timezone: a.timezone ?? booking.timezone,
                  hostName: booking.host?.name ?? "your host",
                  attendeeName: a.name ?? a.email,
                  meetingUrl: booking.meetingUrl ?? undefined,
                  location: booking.location ?? undefined,
                  manageUrl: `${appUrl}/booking/${booking.uid}`,
                  subjectTemplate: workflow.subjectTemplate ?? "",
                  bodyTemplate: workflow.bodyTemplate ?? "",
                  heading: workflow.name,
                }),
                to: a.email,
              }),
            ),
          );
        }
        await db
          .update(schema.scheduledReminders)
          .set({ sentAt: new Date() })
          .where(eq(schema.scheduledReminders.id, reminder.id));
        return;
      }

      // Proactive overflow (#1): this booking's scheduled end just arrived. If a
      // back-to-back meeting follows within the tight window and the host opted
      // in, auto-notify the NEXT meeting's attendees that the host is running a
      // few minutes behind - the "quick snap at the end of a meeting" an EA does.
      if (reminder.kind === "overflow") {
        const OVERFLOW_TIGHT_MS = 20 * 60_000;
        if (booking.hostId && booking.status !== "cancelled" && booking.status !== "rejected") {
          const prefs = await db.query.userPreferences.findFirst({
            where: eq(schema.userPreferences.userId, booking.hostId),
            columns: { overflowNotifyEnabled: true },
          });
          if (prefs?.overflowNotifyEnabled) {
            const next = await db.query.bookings.findFirst({
              where: and(
                eq(schema.bookings.hostId, booking.hostId),
                eq(schema.bookings.status, "confirmed"),
                gt(schema.bookings.startsAt, booking.endsAt),
                lt(
                  schema.bookings.startsAt,
                  new Date(booking.endsAt.getTime() + OVERFLOW_TIGHT_MS),
                ),
              ),
              orderBy: asc(schema.bookings.startsAt),
              with: { attendees: true, host: true },
            });
            if (next) {
              await Promise.all(
                next.attendees.map((a) =>
                  sendEmail({
                    ...bookingRunningLate({
                      eventTitle: next.title,
                      start: next.startsAt,
                      end: next.endsAt,
                      timezone: a.timezone ?? next.timezone,
                      hostName: next.host?.name ?? "your host",
                      attendeeName: a.name ?? a.email,
                      meetingUrl: next.meetingUrl ?? undefined,
                      manageUrl: `${appUrl}/booking/${next.uid}`,
                    }),
                    to: a.email,
                  }),
                ),
              );
            }
          }
        }
        await db
          .update(schema.scheduledReminders)
          .set({ sentAt: new Date() })
          .where(eq(schema.scheduledReminders.id, reminder.id));
        return;
      }

      // Post-meeting recap ("Scribe") - nudge the HOST just after the meeting
      // ends to capture notes and take the obvious next step. Skipped if the
      // meeting was cancelled/rejected.
      if (reminder.kind === "scribe") {
        if (
          booking.hostId &&
          booking.host?.email &&
          booking.status !== "cancelled" &&
          booking.status !== "rejected"
        ) {
          await sendEmail({
            ...meetingRecap({
              hostName: booking.host.name?.split(" ")[0] ?? "",
              eventTitle: booking.title,
              start: booking.startsAt,
              end: booking.endsAt,
              timezone: booking.host.timezone ?? booking.timezone,
              attendees: booking.attendees.map((a) => a.name ?? a.email),
              bookAgainUrl: `${appUrl}/dashboard`,
              messageUrl: `${appUrl}/bookings/${booking.uid}`,
              manageUrl: `${appUrl}/bookings/${booking.uid}`,
            }),
            to: booking.host.email,
          }).catch(() => 0);
        }
        await db
          .update(schema.scheduledReminders)
          .set({ sentAt: new Date() })
          .where(eq(schema.scheduledReminders.id, reminder.id));
        return;
      }

      // Post-meeting follow-up - send unless the meeting was cancelled/rejected.
      // Branch the copy on the outcome: a no-show gets a warm "let's rebook"
      // note; a completed/confirmed meeting gets the usual "thanks for meeting".
      if (reminder.kind === "followup") {
        if (booking.status !== "cancelled" && booking.status !== "rejected") {
          const render = booking.status === "no_show" ? bookingNoShowFollowUp : bookingFollowUp;
          await Promise.all(
            booking.attendees.map((a) =>
              sendEmail({
                ...render({
                  eventTitle: booking.title,
                  start: booking.startsAt,
                  end: booking.endsAt,
                  timezone: a.timezone ?? booking.timezone,
                  hostName: booking.host?.name ?? "your host",
                  attendeeName: a.name ?? a.email,
                  manageUrl: `${appUrl}/booking/${booking.uid}`,
                }),
                to: a.email,
              }),
            ),
          );
        }
        await db
          .update(schema.scheduledReminders)
          .set({ sentAt: new Date() })
          .where(eq(schema.scheduledReminders.id, reminder.id));
        return;
      }

      if (booking.status !== "confirmed") return;
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
      // WhatsApp / push). Best-effort - never blocks the attendee emails above.
      if (booking.hostId) {
        const when = DateTime.fromJSDate(booking.startsAt)
          .setZone(booking.host?.timezone ?? booking.timezone)
          .toFormat("ccc, LLL d 'at' h:mm a");
        await deliverUserReminder(booking.hostId, {
          title: `Upcoming: ${booking.title}`,
          body: `Starts ${label} - ${when}.`,
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
