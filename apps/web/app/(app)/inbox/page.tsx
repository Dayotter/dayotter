import { FocusDefense } from "@/components/focus-defense";
import { PageHeader } from "@/components/page-header";
import { PendingInvites } from "@/components/pending-invites";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aiEnabled } from "@/lib/ai/llm";
import { getSession } from "@/lib/auth/session";
import { inboxData } from "@/lib/calendar/inbox";
import { getRecommendations } from "@/lib/intelligence/recommendations";
import { AlertTriangle, PlugZap, Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft 365",
  apple: "Apple iCloud",
};

export default async function InboxPage() {
  const session = await getSession();
  const userId = session!.user.id;
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";
  const [{ reconnect, conflicts }, recommendations] = await Promise.all([
    inboxData(userId),
    getRecommendations({ userId, tz }),
  ]);

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Everything about your calendar that needs a decision — in one place."
      />

      {/* Broken sync — needs re-auth */}
      {reconnect.length > 0 ? (
        <div className="mb-4 space-y-2">
          {reconnect.map((c) => (
            <Card
              key={c.connectionId}
              className="flex flex-wrap items-center justify-between gap-3 border-[var(--color-amber)]/40 px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <PlugZap size={18} className="mt-0.5 text-[var(--color-amber)]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {PROVIDER_LABEL[c.provider] ?? c.provider} stopped syncing
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {c.account}
                    {c.error ? ` · ${c.error}` : ""} — reconnect to keep availability accurate.
                  </p>
                </div>
              </div>
              <Link
                href="/settings/calendars"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Reconnect
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Double-booking conflicts (from the unified event model) */}
      {conflicts.length > 0 ? (
        <div className="mb-4 space-y-2">
          {conflicts.map((c) => (
            <Card
              key={c.uid}
              className="flex flex-wrap items-center justify-between gap-3 border-[var(--color-danger)]/40 px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 text-[var(--color-danger)]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Double-booked: {c.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {DateTime.fromISO(c.startsAt).setZone(tz).toFormat("ccc, LLL d · h:mm a")}{" "}
                    clashes with “{c.clashTitle}” on your calendar.
                  </p>
                </div>
              </div>
              <Link
                href={`/booking/${c.uid}/reschedule`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Reschedule
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Pending calendar invitations (lazy, client-fetched) */}
      <PendingInvites aiEnabled={aiEnabled} />

      {/* Focus-time protection suggestions (lazy, client-fetched) */}
      <FocusDefense />

      {/* Optimization nudges from the Intelligence engine */}
      {recommendations.length > 0 ? (
        <Card className="mt-2 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--color-accent)]" />
            <p className="text-sm font-medium">Suggested optimizations</p>
          </div>
          <div className="space-y-2.5">
            {recommendations.map((r) => (
              <div key={r.id}>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-[var(--color-muted)]">{r.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {reconnect.length === 0 && conflicts.length === 0 && recommendations.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          No sync problems or double-bookings right now. Pending invites and focus suggestions, if
          any, appear above.
        </p>
      ) : null}
    </>
  );
}
