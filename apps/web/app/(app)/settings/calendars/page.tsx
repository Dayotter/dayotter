import { AppleConnectForm } from "@/components/apple-connect-form";
import { CalendarManager, DisconnectButton } from "@/components/calendar-manager";
import { IcsConnectForm } from "@/components/ics-connect-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ZoomConnect } from "@/components/zoom-connect";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { zoomEnabled } from "@/lib/integrations/zoom";
import { eq, getDb, schema } from "@dayotter/db";
import { CheckCircle2, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  { id: "google", name: "Google Calendar", color: "#4285F4", available: true },
  { id: "microsoft", name: "Microsoft 365 / Outlook", color: "#0078D4", available: true },
  { id: "apple", name: "Apple iCloud", color: "#A2AAAD", available: true },
  { id: "ics", name: "Calendar feed (ICS)", color: "#6366F1", available: true },
] as const;

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; calendars?: string; error?: string; zoom?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;

  const connections = await getDb().query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, session!.user.id),
    with: { calendars: true },
  });

  return (
    <>
      {params.connected ? (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={16} />
          Connected {params.connected}
          {params.calendars ? ` · ${params.calendars} calendars found` : ""}.
        </div>
      ) : null}
      {params.error ? (
        <div className="mb-5 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          Couldn't connect: {params.error}
        </div>
      ) : null}
      {params.zoom === "connected" ? (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={16} /> Zoom connected. New Zoom bookings get a meeting automatically.
        </div>
      ) : params.zoom === "error" ? (
        <div className="mb-5 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          Couldn't connect Zoom. Please try again.
        </div>
      ) : null}

      {/* Connected accounts */}
      {connections.length > 0 ? (
        <div className="mb-6 space-y-3">
          {connections.map((conn) => {
            const meta = PROVIDERS.find((p) => p.id === conn.provider);
            return (
              <Card key={conn.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: meta?.color }}
                      />
                      {meta?.name ?? conn.provider}
                    </span>
                  }
                  description={conn.externalAccountId}
                  action={
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          conn.status === "active"
                            ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                            : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
                        )}
                      >
                        {conn.status}
                      </span>
                      <DisconnectButton connectionId={conn.id} />
                    </span>
                  }
                />
                <CardBody>
                  {conn.lastError ? (
                    <p className="mb-2 rounded-sm bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
                      Last sync failed: {conn.lastError}. Try reconnecting this calendar.
                    </p>
                  ) : null}
                  {conn.lastSyncedAt ? (
                    <p className="mb-2 text-xs text-[var(--color-faint)]">
                      Last synced {new Date(conn.lastSyncedAt).toLocaleString()}
                    </p>
                  ) : null}
                  <CalendarManager
                    calendars={conn.calendars.map((cal) => ({
                      id: cal.id,
                      name: cal.name,
                      checkForConflicts: cal.checkForConflicts,
                      isTargetForBookings: cal.isTargetForBookings,
                      isReadOnly: cal.isReadOnly,
                      isHidden: cal.isHidden,
                    }))}
                  />
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Add a calendar */}
      <Card>
        <CardHeader title="Add a calendar" description="Link another account." />
        <CardBody className="space-y-2">
          {PROVIDERS.map((p) =>
            p.id === "apple" ? (
              <AppleConnectForm key={p.id} name={p.name} color={p.color} />
            ) : p.id === "ics" ? (
              <IcsConnectForm key={p.id} name={p.name} color={p.color} />
            ) : (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-xs font-bold text-white"
                    style={{ background: p.color }}
                  >
                    {p.name.charAt(0)}
                  </span>
                  {p.name}
                </span>
                {p.available ? (
                  // Plain <a>, NOT next/link: this is an API route that 302s to the
                  // provider's OAuth page. A <Link> makes Next RSC-prefetch/fetch it,
                  // which then hits the provider cross-origin and fails CORS. A full
                  // browser navigation is exactly what OAuth needs.
                  <a
                    href={`/api/calendars/connect/${p.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Plus size={15} /> Connect
                  </a>
                ) : (
                  <span className="text-xs text-[var(--color-faint)]">Coming soon</span>
                )}
              </div>
            ),
          )}
        </CardBody>
      </Card>

      {/* Video conferencing (Zoom) - only when configured on this server. */}
      {zoomEnabled ? (
        <Card className="mt-6">
          <CardHeader
            title="Video conferencing"
            description="Connect Zoom to auto-create a meeting for every Zoom booking."
          />
          <CardBody>
            <ZoomConnect />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
