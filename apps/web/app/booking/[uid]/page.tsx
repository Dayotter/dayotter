import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { googleCalendarUrl } from "@/lib/booking/ics";
import { formatMoney } from "@/lib/booking/money";
import { eq, getDb, schema } from "@dayotter/db";
import {
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Video,
} from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { host: true, attendees: true },
  });
  if (!booking) notFound();

  const eventType = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, booking.eventTypeId),
    columns: { questions: true },
  });
  const responses = (booking.responses ?? {}) as Record<string, unknown>;
  const answered = (eventType?.questions ?? [])
    .map((q) => ({ label: q.label, value: responses[q.id] }))
    .filter((r) => r.value !== undefined && r.value !== "" && r.value !== false);

  const cancelled = booking.status === "cancelled";
  const when = DateTime.fromJSDate(booking.startsAt)
    .setZone(booking.timezone)
    .toFormat("cccc, LLLL d, yyyy");
  const time = `${DateTime.fromJSDate(booking.startsAt).setZone(booking.timezone).toFormat("h:mm a")} – ${DateTime.fromJSDate(booking.endsAt).setZone(booking.timezone).toFormat("h:mm a")}`;

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:py-16">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            {cancelled ? (
              <CalendarX2 size={44} className="text-[var(--color-danger)]" />
            ) : (
              <CheckCircle2 size={44} className="text-[var(--color-success)]" />
            )}
            <h1 className="font-display mt-4 text-2xl leading-tight tracking-[-0.01em]">
              {cancelled ? "Booking cancelled" : "You're booked!"}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {cancelled
                ? "This meeting has been cancelled."
                : `A confirmation was sent to ${booking.attendees[0]?.email ?? "your email"}.`}
            </p>
          </div>

          <div className="mt-6 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="font-medium">{booking.title}</p>
            <p className="text-sm text-[var(--color-muted)]">
              with {booking.host?.name ?? "your host"}
            </p>
            <div className="space-y-1.5 pt-1 text-sm">
              <p className="flex items-center gap-2">
                <Clock size={15} className="text-[var(--color-muted)]" />
                {when} · {time}
                <span className="text-[var(--color-muted)]">({booking.timezone})</span>
              </p>
              {booking.meetingUrl && !cancelled ? (
                <p className="flex items-center gap-2">
                  <Video size={15} className="text-[var(--color-muted)]" />
                  <a
                    href={booking.meetingUrl}
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    Join the call
                  </a>
                </p>
              ) : null}
              {booking.amountPaid && booking.paymentStatus !== "none" ? (
                <p className="flex items-center gap-2">
                  <CreditCard size={15} className="text-[var(--color-muted)]" />
                  {booking.paymentStatus === "refunded" ? "Refunded " : "Paid "}
                  {formatMoney(booking.amountPaid, booking.paymentCurrency ?? "usd")}
                </p>
              ) : null}
            </div>

            {answered.length > 0 ? (
              <dl className="space-y-2 border-t border-[var(--color-border)] pt-3 text-sm">
                {answered.map((r) => (
                  <div key={r.label}>
                    <dt className="text-xs text-[var(--color-muted)]">{r.label}</dt>
                    <dd className="text-[var(--color-text)]">
                      {r.value === true ? "Yes" : String(r.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {!cancelled ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <a
                href={googleCalendarUrl({
                  uid: booking.uid,
                  title: booking.title,
                  description: booking.description,
                  start: booking.startsAt,
                  end: booking.endsAt,
                  location: booking.location,
                  meetingUrl: booking.meetingUrl,
                })}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <CalendarPlus size={15} /> Google Calendar
              </a>
              <a
                href={`/api/bookings/${uid}/ics`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download size={15} /> Download .ics
              </a>
            </div>
          ) : null}

          {!cancelled ? (
            <div className="mt-3 flex justify-center gap-2">
              <Link
                href={`/booking/${uid}/reschedule`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Reschedule
              </Link>
              <Link
                href={`/booking/${uid}/cancel`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Cancel booking
              </Link>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
        Powered by <span className="text-[var(--color-muted)]">dayotter</span>
      </p>
    </main>
  );
}
