import { enqueueCrmSync } from "@dayotter/jobs";
import { runPluginBookingHooks } from "@dayotter/plugin-host";
import { emitWebhook } from "../webhooks/emit";

type LifecycleAction = "created" | "rescheduled" | "cancelled";

const WEBHOOK_EVENT = {
  created: "booking.created",
  rescheduled: "booking.rescheduled",
  cancelled: "booking.cancelled",
} as const;

/** The common shape the CRM sync + plugin hooks receive for a booking change. */
export interface BookingDescriptor {
  bookingId: string;
  uid: string;
  hostId: string;
  eventTypeId: string | null;
  title: string;
  /** ISO-8601 UTC. */
  startsAt: string;
  endsAt: string;
  attendees: { name: string | null; email: string }[];
  reason?: string | null;
}

/**
 * The single place a booking lifecycle change fans out to its side effects:
 * the host's webhook endpoints, CRM sync, and enabled plugin hooks. Each event's
 * webhook payload is passed in (they legitimately differ); the CRM + plugin
 * payloads are derived once from the descriptor. All best-effort - a side-effect
 * failure never blocks or throws into the booking flow.
 */
export async function fanOutBookingLifecycle(
  action: LifecycleAction,
  booking: BookingDescriptor,
  webhookData: Record<string, unknown>,
): Promise<void> {
  await emitWebhook(booking.hostId, WEBHOOK_EVENT[action], webhookData);
  await enqueueCrmSync({ bookingId: booking.bookingId, action }).catch(() => {});
  await runPluginBookingHooks(action, {
    bookingId: booking.bookingId,
    uid: booking.uid,
    hostId: booking.hostId,
    eventTypeId: booking.eventTypeId,
    title: booking.title,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    attendees: booking.attendees,
    reason: booking.reason ?? null,
  });
}
