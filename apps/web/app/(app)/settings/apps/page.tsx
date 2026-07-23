import { AppStore } from "@/components/app-store";
import { APPS } from "@/lib/apps/registry";
import { resolveAppStatuses } from "@/lib/apps/status";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppsSettingsPage() {
  const session = await getSession();
  if (!session?.user) return null; // the (app) layout redirects; this guards the render race

  const statuses = await resolveAppStatuses(session.user.id);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Apps</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Everything DayOtter connects to - calendars, video, CRM, payments, messaging and
          automation. Anything marked <em>Not configured</em> needs credentials set on this server.
        </p>
      </div>

      <AppStore apps={APPS} statuses={statuses} />
    </>
  );
}
