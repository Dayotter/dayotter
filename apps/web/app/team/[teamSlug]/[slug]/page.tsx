import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody } from "@/components/ui/card";
import { LOCATION_LABELS, offeredLocations } from "@/lib/booking/event-type-input";
import { chargeFor, formatMoney } from "@/lib/booking/money";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, eq, getDb, schema } from "@dayotter/db";
import { Clock, CreditCard, Users, Video } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  collective: "Meet the whole team",
  round_robin: "You'll be matched with an available host",
};

export default async function TeamBookingPage({
  params,
}: {
  params: Promise<{ teamSlug: string; slug: string }>;
}) {
  const { teamSlug, slug } = await params;
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.slug, teamSlug),
    with: { members: { with: { user: true } } },
  });
  if (!team) notFound();

  const eventType = await db.query.eventTypes.findFirst({
    where: and(
      eq(schema.eventTypes.teamId, team.id),
      eq(schema.eventTypes.slug, slug),
      eq(schema.eventTypes.isActive, true),
    ),
  });
  if (!eventType) notFound();

  // Collective events let the booker pick which members to meet. Offer only the
  // publicly-bookable hosts of this event; a picker needs at least two of them.
  const eventHostRows =
    eventType.schedulingType === "collective"
      ? await db.query.eventTypeHosts.findMany({
          where: eq(schema.eventTypeHosts.eventTypeId, eventType.id),
          columns: { userId: true },
        })
      : [];
  const eventHostIds = new Set(eventHostRows.map((h) => h.userId));
  const teamHosts = team.members
    .filter((m) => m.publicBookable && m.user && eventHostIds.has(m.userId))
    .map((m) => ({ id: m.userId, name: m.user?.name ?? m.user?.email ?? "Team member" }));
  const selectableHosts = teamHosts.length >= 2 ? teamHosts : [];

  // Locations the booker may choose from (falls back to the single location).
  const offered = offeredLocations(eventType);
  const locationChoices =
    offered.length > 1 && (eventType.maxAttendees ?? 1) <= 1
      ? offered.map((o) => ({ type: o.type, label: LOCATION_LABELS[o.type] ?? o.type }))
      : [];

  const chargeAmount = paymentsEnabled ? chargeFor(eventType.price, eventType.depositAmount) : 0;
  const priceLabel =
    chargeAmount > 0 ? formatMoney(chargeAmount, eventType.currency ?? "usd") : null;
  const isDeposit =
    priceLabel !== null &&
    eventType.depositAmount != null &&
    eventType.price != null &&
    eventType.depositAmount < eventType.price;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-b border-[var(--color-border)] p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Users size={17} />
              </div>
              <span className="text-sm text-[var(--color-muted)]">{team.name}</span>
            </div>
            <h1 className="font-display mt-4 text-2xl leading-tight tracking-[-0.01em]">
              {eventType.title}
            </h1>
            {eventType.description ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">{eventType.description}</p>
            ) : null}
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {TYPE_LABEL[eventType.schedulingType] ?? ""}
            </p>

            {/* Host avatars */}
            <div className="mt-4 flex -space-x-2">
              {team.members.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  title={m.user?.name ?? m.user?.email ?? ""}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-accent)] text-xs font-semibold text-white"
                >
                  {(m.user?.name ?? m.user?.email ?? "?").charAt(0).toUpperCase()}
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm text-[var(--color-muted)]">
              <p className="flex items-center gap-2">
                <Clock size={15} /> {eventType.durationMinutes} minutes
              </p>
              <p className="flex items-center gap-2">
                <Video size={15} />{" "}
                {locationChoices.length > 1
                  ? locationChoices.map((l) => l.label).join(" · ")
                  : (LOCATION_LABELS[eventType.location] ?? eventType.location)}
              </p>
              {priceLabel ? (
                <p className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                  <CreditCard size={15} /> {priceLabel}
                  {isDeposit ? (
                    <span className="text-xs font-normal text-[var(--color-faint)]">deposit</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          <CardBody className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Select a time</h2>
            <SlotPicker
              eventTypeId={eventType.id}
              questions={eventType.questions}
              priceLabel={priceLabel}
              defaultDuration={eventType.durationMinutes}
              durationOptions={eventType.durationOptions ?? []}
              requiresCode={eventType.accessCodeHash != null}
              teamHosts={selectableHosts}
              locations={locationChoices}
            />
          </CardBody>
        </div>
      </Card>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--color-faint)]">
        <span className="relative inline-block h-3.5 w-3.5 shrink-0 overflow-hidden rounded-[3px]">
          <img
            src="/brand/dayotter-icon.svg"
            alt=""
            width={21}
            height={21}
            className="absolute -left-[3px] -top-[3px] max-w-none"
          />
        </span>
        Powered by <span className="text-[var(--color-muted)]">DayOtter</span>
      </p>
    </main>
  );
}
