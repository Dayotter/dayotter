import { FocusDefense } from "@/components/focus-defense";
import { PageHeader } from "@/components/page-header";
import { PendingInvites } from "@/components/pending-invites";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aiEnabled } from "@/lib/ai/llm";
import { getSession } from "@/lib/auth/session";
import { inboxData } from "@/lib/calendar/inbox";
import { AlertTriangle, PlugZap } from "lucide-react";
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
  const { reconnect, conflicts } = await inboxData(userId);

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

      {reconnect.length === 0 && conflicts.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          No sync problems or double-bookings right now. Pending invites and focus suggestions, if
          any, appear above.
        </p>
      ) : null}
    </>
  );
}
