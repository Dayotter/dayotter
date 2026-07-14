import { CrmDisconnectButton } from "@/components/crm-manager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { eq, getDb, schema } from "@dayotter/db";
import { crmEnabledProviders } from "@dayotter/integrations";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  {
    id: "salesforce",
    name: "Salesforce",
    color: "#00A1E0",
    blurb: "Log every booking as an Event on the matched Contact.",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    color: "#FF7A59",
    blurb: "Create the contact and log the meeting, kept in sync on reschedule.",
  },
] as const;

export default async function CrmSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ crm?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) return null; // the (app) layout redirects; this guards the render race
  const params = await searchParams;

  const connections = await getDb().query.crmConnections.findMany({
    where: eq(schema.crmConnections.userId, session.user.id),
  });
  const enabled = crmEnabledProviders();

  return (
    <>
      {params.crm === "connected" ? (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={16} /> CRM connected. New bookings sync automatically.
        </div>
      ) : params.crm === "error" ? (
        <div className="mb-5 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          Couldn't connect that CRM. Please try again.
        </div>
      ) : params.crm === "upgrade" ? (
        <div className="mb-5 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-text)]">
          CRM sync is a Pro feature.{" "}
          <Link href="/settings/billing" className="font-medium text-[var(--color-accent)]">
            Upgrade
          </Link>{" "}
          to connect Salesforce or HubSpot.
        </div>
      ) : params.crm === "unavailable" ? (
        <div className="mb-5 rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          That CRM isn't configured on this server yet.
        </div>
      ) : null}

      <div className="mb-6">
        <h2 className="text-lg font-semibold">CRM sync</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Push every booking to your CRM: DayOtter finds or creates the guest as a contact and logs
          the meeting as an activity - updated on reschedule, closed on cancel.
        </p>
      </div>

      {/* Connected CRMs */}
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
                  description={conn.accountLabel ?? conn.externalAccountId}
                  action={<CrmDisconnectButton provider={conn.provider} />}
                />
                {conn.lastError ? (
                  <CardBody>
                    <p className="flex items-center gap-1.5 text-sm text-[var(--color-danger)]">
                      <AlertTriangle size={14} /> Last sync error: {conn.lastError}
                    </p>
                  </CardBody>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Connect a CRM */}
      <Card>
        <CardHeader title="Connect a CRM" description="One click - OAuth, no API keys to paste." />
        <CardBody>
          <div className="space-y-3">
            {PROVIDERS.map((p) => {
              const isConnected = connections.some((c) => c.provider === p.id);
              const isAvailable = enabled.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{p.blurb}</p>
                    </div>
                  </div>
                  {isConnected ? (
                    <span className="flex items-center gap-1 text-sm text-[var(--color-success)]">
                      <CheckCircle2 size={15} /> Connected
                    </span>
                  ) : isAvailable ? (
                    <Link
                      href={`/api/integrations/crm/${p.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                    >
                      <Plus size={14} /> Connect
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--color-faint)]">Not configured</span>
                  )}
                </div>
              );
            })}
          </div>
          {enabled.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--color-faint)]">
              No CRM is configured on this server. Set the provider's client id + secret in the
              environment to enable it.
            </p>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
