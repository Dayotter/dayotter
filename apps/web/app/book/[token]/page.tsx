import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody } from "@/components/ui/card";
import { LOCATION_LABELS } from "@/lib/booking/event-type-input";
import { chargeFor, formatMoney } from "@/lib/booking/money";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { eq, getDb, schema } from "@calsync/db";
import { Clock, CreditCard, Video } from "lucide-react";

export const dynamic = "force-dynamic";

/** Booking via a single-use / expiring link (Calendly one-off link). */
export default async function OneOffBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.bookingLinks.findFirst({
    where: eq(schema.bookingLinks.token, token),
  });

  const invalid =
    !link ||
    link.usedCount >= link.maxUses ||
    (link.expiresAt !== null && link.expiresAt < new Date().toISOString().slice(0, 10));

  if (invalid) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl">This link is no longer available</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Single-use links expire once they've been booked. Please ask for a fresh link.
        </p>
      </main>
    );
  }

  const eventType = await db.query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, link.eventTypeId),
  });
  if (!eventType || !eventType.isActive) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl">This meeting isn't available</h1>
      </main>
    );
  }
  const host = await db.query.users.findFirst({ where: eq(schema.users.id, link.ownerId) });

  const chargeAmount = paymentsEnabled ? chargeFor(eventType.price, eventType.depositAmount) : 0;
  const priceLabel =
    chargeAmount > 0 ? formatMoney(chargeAmount, eventType.currency ?? "usd") : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-b border-[var(--color-border)] p-6 md:border-b-0 md:border-r">
            <span className="text-sm text-[var(--color-muted)]">{host?.name ?? host?.handle}</span>
            <h1 className="font-display mt-2 text-2xl leading-tight tracking-[-0.01em]">
              {eventType.title}
            </h1>
            {eventType.description ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">{eventType.description}</p>
            ) : null}
            <div className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
              <p className="flex items-center gap-2">
                <Clock size={15} /> {eventType.durationMinutes} minutes
              </p>
              <p className="flex items-center gap-2">
                <Video size={15} /> {LOCATION_LABELS[eventType.location] ?? eventType.location}
              </p>
              {priceLabel ? (
                <p className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                  <CreditCard size={15} /> {priceLabel}
                </p>
              ) : null}
            </div>
            <p className="mt-4 rounded-sm bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-faint)]">
              This is a private, single-use booking link.
            </p>
          </div>

          <CardBody className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Select a time</h2>
            <SlotPicker
              eventTypeId={eventType.id}
              questions={eventType.questions}
              priceLabel={priceLabel}
              defaultDuration={eventType.durationMinutes}
              durationOptions={eventType.durationOptions ?? []}
              linkToken={token}
            />
          </CardBody>
        </div>
      </Card>
    </main>
  );
}
