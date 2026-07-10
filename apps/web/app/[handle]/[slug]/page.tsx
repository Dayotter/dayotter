import { HostAvatar } from "@/components/host-avatar";
import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody } from "@/components/ui/card";
import { ViewTracker } from "@/components/view-tracker";
import { getEntitlements } from "@/lib/billing/entitlements";
import { brandStyle, getHostBranding } from "@/lib/booking/branding";
import { LOCATION_LABELS } from "@/lib/booking/event-type-input";
import { chargeFor, formatMoney } from "@/lib/booking/money";
import { brandingHidden } from "@/lib/ee/white-label";
import { resolveLocale, t } from "@/lib/i18n/booking";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, eq, getDb, schema } from "@calsync/db";
import { Clock, CreditCard, Video } from "lucide-react";
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

  // White-label (cloud + Pro): the host can hide the calSync mark.
  const hostEnt = await getEntitlements(host.id);
  const hideBranding = brandingHidden({ isPro: hostEnt.isPro });
  const branding = await getHostBranding(host.id);
  const locale = resolveLocale((await headers()).get("accept-language"));

  const chargeAmount = paymentsEnabled ? chargeFor(eventType.price, eventType.depositAmount) : 0;
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
      <Card>
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          {/* Event details */}
          <div className="border-b border-[var(--color-border)] p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <HostAvatar name={host.name ?? host.handle ?? "?"} image={host.image} size={36} />
              <span className="text-sm text-[var(--color-muted)]">{host.name ?? host.handle}</span>
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
                <Clock size={15} /> {t(locale, "minutes", { n: eventType.durationMinutes })}
              </p>
              <p className="flex items-center gap-2">
                <Video size={15} /> {LOCATION_LABELS[eventType.location] ?? eventType.location}
              </p>
              {priceLabel ? (
                <p className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                  <CreditCard size={15} /> {priceLabel}
                  {isDeposit ? (
                    <span className="text-xs font-normal text-[var(--color-faint)]">
                      {t(locale, "deposit")}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          {/* Slot picker */}
          <CardBody className="p-6">
            <h2 className="mb-4 text-sm font-semibold">{t(locale, "selectTime")}</h2>
            <SlotPicker
              eventTypeId={eventType.id}
              questions={eventType.questions}
              priceLabel={priceLabel}
              defaultDuration={eventType.durationMinutes}
              durationOptions={eventType.durationOptions ?? []}
              requiresCode={eventType.accessCodeHash != null}
            />
          </CardBody>
        </div>
      </Card>
      {hideBranding ? null : (
        <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
          Powered by <span className="text-[var(--color-muted)]">calSync</span>
        </p>
      )}
    </main>
  );
}
