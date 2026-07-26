import { EmbedBridge } from "@/components/embed-bridge";
import { SlotPicker } from "@/components/slot-picker";
import { aiEnabled } from "@/lib/ai/llm";
import { brandStyle, getHostBranding } from "@/lib/booking/branding";
import { LOCATION_LABELS } from "@/lib/booking/event-type-input";
import { chargeFor, formatMoney } from "@/lib/booking/money";
import { resolveLocale, t } from "@/lib/i18n/booking";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, eq, getDb, schema } from "@dayotter/db";
import { Clock, Video } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Chrome-less booking flow for embedding in an iframe (embed.js or the
 * @dayotter/embed-react SDK). Same data as the public page, minus the site
 * shell, plus theme/brand from the query and an EmbedBridge that relays height +
 * booking events to the parent window.
 */
export default async function EmbedBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle, slug } = await params;
  const sp = await searchParams;
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

  const branding = await getHostBranding(host.id);
  const locale = resolveLocale((await headers()).get("accept-language"));
  const chargeAmount = paymentsEnabled ? chargeFor(eventType.price, eventType.depositAmount) : 0;
  const priceLabel =
    chargeAmount > 0 ? formatMoney(chargeAmount, eventType.currency ?? "usd") : null;

  const themeParam = typeof sp.theme === "string" ? sp.theme : "auto";
  const theme = themeParam === "dark" ? "dark" : themeParam === "light" ? "light" : "auto";
  const primaryColor =
    typeof sp.primaryColor === "string"
      ? `#${sp.primaryColor.replace(/^#/, "")}`
      : branding.brandColor;
  const hideDetails = sp.hideDetails === "1" || sp.hideDetails === "true";

  return (
    <main style={brandStyle(primaryColor)} className="mx-auto max-w-2xl px-4 py-5">
      <EmbedBridge theme={theme} />
      <LocaleProvider locale={locale}>
        {hideDetails ? null : (
          <div className="mb-5">
            <h1 className="font-display text-xl leading-tight tracking-[-0.01em]">
              {eventType.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-muted)]">
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {t(locale, "minutes", { n: eventType.durationMinutes })}
              </span>
              <span className="flex items-center gap-1.5">
                <Video size={14} /> {LOCATION_LABELS[eventType.location] ?? eventType.location}
              </span>
              {priceLabel ? <span className="font-medium">{priceLabel}</span> : null}
            </div>
            {eventType.description ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">{eventType.description}</p>
            ) : null}
          </div>
        )}
        <SlotPicker
          embed
          eventTypeId={eventType.id}
          questions={eventType.questions}
          priceLabel={priceLabel}
          defaultDuration={eventType.durationMinutes}
          durationOptions={eventType.durationOptions ?? []}
          requiresCode={eventType.accessCodeHash != null}
        />
      </LocaleProvider>
    </main>
  );
}
