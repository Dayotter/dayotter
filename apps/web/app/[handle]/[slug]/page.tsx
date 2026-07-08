import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody } from "@/components/ui/card";
import { LOCATION_LABELS } from "@/lib/booking/event-type-input";
import { and, eq, getDb, schema } from "@calsync/db";
import { Clock, Video } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;
  const db = getDb();

  const host = await db.query.users.findFirst({ where: eq(schema.users.handle, handle) });
  if (!host) notFound();

  const eventType = await db.query.eventTypes.findFirst({
    where: and(
      eq(schema.eventTypes.ownerId, host.id),
      eq(schema.eventTypes.slug, slug),
      eq(schema.eventTypes.isActive, true),
    ),
  });
  if (!eventType) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          {/* Event details */}
          <div className="border-b border-[var(--color-border)] p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white">
                {(host.name ?? host.handle ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-[var(--color-muted)]">{host.name ?? host.handle}</span>
            </div>
            <h1 className="font-display mt-4 text-2xl leading-tight tracking-[-0.01em]">
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
            </div>
          </div>

          {/* Slot picker */}
          <CardBody className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Select a time</h2>
            <SlotPicker eventTypeId={eventType.id} questions={eventType.questions} />
          </CardBody>
        </div>
      </Card>
      <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
        Powered by <span className="text-[var(--color-muted)]">calSync</span>
      </p>
    </main>
  );
}
