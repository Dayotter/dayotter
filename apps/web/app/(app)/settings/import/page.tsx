import { CalendlyImport } from "@/components/calendly-import";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ImportSettingsPage() {
  const session = await getSession();
  if (!session?.user) return null; // the (app) layout redirects; this guards the render race

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Import from Calendly</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Switching over? Bring your event types and weekly availability across in one step. We read
          them straight from Calendly with a token you paste below - nothing is changed on the
          Calendly side, and existing DayOtter data is never overwritten.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Calendly"
          description="Event types and availability schedules. Upcoming bookings aren't moved."
        />
        <CardBody>
          <CalendlyImport />
        </CardBody>
      </Card>

      <p className="mt-4 text-xs text-[var(--color-faint)]">
        Team round-robin / collective events import as personal event types you host. Date-specific
        availability overrides and per-event schedules aren't mapped yet - double-check imported
        event types before sharing them.
      </p>
    </>
  );
}
