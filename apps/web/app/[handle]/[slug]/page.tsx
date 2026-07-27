import { BookingPixels } from "@/components/booking-pixels";
import { HostAvatar } from "@/components/host-avatar";
import { LanguagePicker } from "@/components/language-picker";
import { SlotPicker } from "@/components/slot-picker";
import { Tr } from "@/components/tr";
import { Card, CardBody } from "@/components/ui/card";
import { ViewTracker } from "@/components/view-tracker";
import { aiEnabled } from "@/lib/ai/llm";
import { getEntitlements } from "@/lib/billing/entitlements";
import { sanitizePixelConfig } from "@/lib/booking/analytics-pixels";
import { brandStyle, getHostBranding } from "@/lib/booking/branding";
import { LOCATION_LABELS, offeredLocations } from "@/lib/booking/event-type-input";
import { chargeFor, formatMoney } from "@/lib/booking/money";
import { brandingHidden } from "@/lib/ee/white-label";
import { resolveLocale } from "@/lib/i18n/booking";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { outOfOfficeOn } from "@/lib/out-of-office";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, eq, getDb, schema } from "@dayotter/db";
import { ArrowRight, Clock, CreditCard, Repeat, TreePalm, Video } from "lucide-react";
import { DateTime } from "luxon";
import { headers } from "next/headers";
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

  // White-label (cloud + Pro): the host can hide the DayOtter mark.
  const hostEnt = await getEntitlements(host.id);
  const hideBranding = brandingHidden({ isPro: hostEnt.isPro });
  const branding = await getHostBranding(host.id);
  const locale = resolveLocale((await headers()).get("accept-language"));

  // If the host is out of office right now (their local "today"), surface it and,
  // when they've named a delegate, offer to redirect the booker to that teammate.
  const hostToday =
    DateTime.now().setZone(host.timezone).toISODate() ?? DateTime.now().toISODate() ?? "";
  const activeOoo = hostToday ? await outOfOfficeOn(host.id, hostToday) : null;

  // Locations the booker may choose from (falls back to the single location).
  // A group event is one shared meeting, so no per-booker choice - use the primary.
  const offered = offeredLocations(eventType);
  const locationChoices =
    offered.length > 1 && (eventType.maxAttendees ?? 1) <= 1
      ? offered.map((o) => ({ type: o.type, label: LOCATION_LABELS[o.type] ?? o.type }))
      : [];

  const chargeAmount = paymentsEnabled ? chargeFor(eventType.price, eventType.depositAmount) : 0;

  // Booking-page AI helper: on when AI is configured and the host hasn't opted out.
  const hostPrefs = await db.query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, host.id),
    columns: { bookingPageAssistant: true, bookingPageAnalytics: true },
  });
  const assistantEnabled = aiEnabled && hostPrefs?.bookingPageAssistant !== false;
  const pixels = sanitizePixelConfig(hostPrefs?.bookingPageAnalytics ?? null);
  const priceLabel =
    chargeAmount > 0 ? formatMoney(chargeAmount, eventType.currency ?? "usd") : null;
  const isDeposit =
    priceLabel !== null &&
    eventType.depositAmount != null &&
    eventType.price != null &&
    eventType.depositAmount < eventType.price;

  return (
    <main
      style={brandStyle(branding.brandColor)}
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <ViewTracker eventTypeId={eventType.id} />
      <BookingPixels config={pixels} />
      {activeOoo ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-surface-2)] px-4 py-3 text-sm">
          <TreePalm size={17} className="mt-0.5 shrink-0 text-[var(--color-amber)]" />
          <div className="min-w-0">
            <p className="font-medium">
              {host.name ?? host.handle} is out of office through{" "}
              {DateTime.fromISO(activeOoo.endDate).toFormat("LLL d, yyyy")}.
            </p>
            {activeOoo.delegate?.handle ? (
              <a
                href={`/${activeOoo.delegate.handle}`}
                className="mt-1 inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
              >
                Book with {activeOoo.delegate.name ?? `@${activeOoo.delegate.handle}`} instead
                <ArrowRight size={14} />
              </a>
            ) : (
              <p className="mt-0.5 text-[var(--color-muted)]">
                You can still book a time once they're back.
              </p>
            )}
          </div>
        </div>
      ) : null}
      <LocaleProvider locale={locale}>
        <Card>
          <div className="grid gap-0 md:grid-cols-[280px_1fr]">
            {/* Event details */}
            <div className="border-b border-[var(--color-border)] p-6 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2">
                <HostAvatar name={host.name ?? host.handle ?? "?"} image={host.image} size={36} />
                <span className="text-sm text-[var(--color-muted)]">
                  {host.name ?? host.handle}
                </span>
              </div>
              {branding.welcomeMessage ? (
                <p className="mt-3 text-sm text-[var(--color-muted)]">{branding.welcomeMessage}</p>
              ) : null}
              <h1 className="font-display mt-4 text-2xl leading-tight tracking-[-0.01em]">
                {eventType.title}
              </h1>
              {eventType.description ? (
                <p className="mt-2 text-sm text-[var(--color-muted)]">{eventType.description}</p>
              ) : null}
              <div className="mt-4 space-y-2 text-sm text-[var(--color-muted)]">
                <p className="flex items-center gap-2">
                  <Clock size={15} /> <Tr k="minutes" vars={{ n: eventType.durationMinutes }} />
                </p>
                <p className="flex items-center gap-2">
                  <Video size={15} />{" "}
                  {locationChoices.length > 1
                    ? locationChoices.map((l) => l.label).join(" · ")
                    : (LOCATION_LABELS[eventType.location] ?? eventType.location)}
                </p>
                {eventType.recurringCount > 1 ? (
                  <p className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                    <Repeat size={15} /> Repeats{" "}
                    {eventType.recurringFrequency === "monthly"
                      ? "monthly"
                      : eventType.recurringFrequency === "biweekly"
                        ? "every 2 weeks"
                        : "weekly"}{" "}
                    · {eventType.recurringCount} sessions
                  </p>
                ) : null}
                {priceLabel ? (
                  <p className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                    <CreditCard size={15} /> {priceLabel}
                    {isDeposit ? (
                      <span className="text-xs font-normal text-[var(--color-faint)]">
                        <Tr k="deposit" />
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Slot picker */}
            <CardBody className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  <Tr k="selectTime" />
                </h2>
                <LanguagePicker />
              </div>
              <SlotPicker
                eventTypeId={eventType.id}
                questions={eventType.questions}
                priceLabel={priceLabel}
                defaultDuration={eventType.durationMinutes}
                durationOptions={eventType.durationOptions ?? []}
                requiresCode={eventType.accessCodeHash != null}
                assistantEnabled={assistantEnabled}
                locations={locationChoices}
              />
            </CardBody>
          </div>
        </Card>
      </LocaleProvider>
      {hideBranding ? null : (
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
      )}
    </main>
  );
}
