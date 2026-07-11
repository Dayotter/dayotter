import { EmptyState, PageHeader } from "@/components/page-header";
import { CreateTeamButton } from "@/components/team-forms";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { eq, getDb, schema } from "@dayotter/db";
import { Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await getSession();
  const memberships = await getDb().query.teamMembers.findMany({
    where: eq(schema.teamMembers.userId, session!.user.id),
    with: { team: { with: { members: true } } },
  });
  const teams = memberships.map((m) => m.team);

  return (
    <>
      <PageHeader
        title="Teams"
        description="Shared availability for your whole raft — every founder and teammate's free time in one place."
        action={<CreateTeamButton />}
      />
      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create a team to find times you're all free — collective and round-robin scheduling, no paywall."
          action={<CreateTeamButton />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.id}`}>
              <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium">{t.name}</h3>
                    <p className="text-sm text-[var(--color-muted)]">
                      {t.members.length} member{t.members.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
