import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { listForms } from "@/lib/routing/routing";
import { Plus, Split, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RoutingPage() {
  const session = await getSession();
  const forms = await listForms(session!.user.id);

  return (
    <>
      <PageHeader
        eyebrow="Routing forms"
        title="Qualify &amp; route"
        description="Ask a few questions up front, then send each visitor to the right booking page - the inbound flow sales teams live on."
        action={
          <Link href="/routing/new" className={buttonVariants()}>
            <Plus size={16} /> New form
          </Link>
        }
      />

      {forms.length === 0 ? (
        <EmptyState
          title="No routing forms yet"
          description="Route enterprise leads to you and everyone else to the team - automatically, based on their answers."
        />
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <Link key={f.id} href={`/routing/${f.id}`}>
              <Card interactive className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium">
                    <Split size={15} className="shrink-0 text-[var(--color-accent)]" />
                    {f.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span>{f.routes.length} rules</span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> {f.responses.length} responses
                    </span>
                  </p>
                </div>
                <span
                  className={
                    f.isActive
                      ? "rounded-full bg-[var(--color-success)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-success)]"
                      : "rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
                  }
                >
                  {f.isActive ? "Live" : "Draft"}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
