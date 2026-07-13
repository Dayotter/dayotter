import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { listPolls } from "@/lib/polls/polls";
import { CheckCircle2, Plus, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PollsPage() {
  const session = await getSession();
  const polls = await listPolls(session!.user.id);

  return (
    <>
      <PageHeader
        eyebrow="Group polls"
        title="Find a time"
        description="Propose times, collect votes, and lock in what works for everyone."
        action={
          <Link href="/polls/new" className={buttonVariants()}>
            <Plus size={16} /> New poll
          </Link>
        }
      />

      {polls.length === 0 ? (
        <EmptyState
          title="No polls yet"
          description="Create a poll to find a time that works across a group — no back-and-forth."
        />
      ) : (
        <div className="space-y-3">
          {polls.map((p) => (
            <Link key={p.id} href={`/polls/${p.id}`}>
              <Card interactive className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span>{p.options.length} time options</span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> {p.votes.length} votes
                    </span>
                  </p>
                </div>
                <span
                  className={
                    p.status === "finalized"
                      ? "inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-success)]"
                      : "rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]"
                  }
                >
                  {p.status === "finalized" ? (
                    <>
                      <CheckCircle2 size={12} /> Finalized
                    </>
                  ) : (
                    "Open"
                  )}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
