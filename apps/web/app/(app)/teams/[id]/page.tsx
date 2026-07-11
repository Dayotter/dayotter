import { PageHeader } from "@/components/page-header";
import { AddMemberForm, CreateTeamEventForm } from "@/components/team-forms";
import { TeamRules } from "@/components/team-rules";
import { TeamScheduleView } from "@/components/team-schedule-view";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { teamSchedule } from "@/lib/booking/team-schedule";
import { eq, getDb, schema } from "@dayotter/db";
import { ExternalLink, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  collective: "Collective · everyone free",
  round_robin: "Round-robin · distributed",
  individual: "Individual",
};

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, id),
    with: { members: { with: { user: true } } },
  });
  if (!team || !team.members.some((m) => m.userId === session!.user.id)) notFound();

  const events = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.teamId, id),
  });

  const rules = await db.query.teamRules.findMany({ where: eq(schema.teamRules.teamId, id) });
  const myRole = team.members.find((m) => m.userId === session!.user.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  // Shared team calendar — everyone's busy times for the next 7 days.
  const viewerTz = (session!.user as { timezone?: string }).timezone ?? "UTC";
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const schedule = await teamSchedule(
    team.members.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? "",
      email: m.user?.email ?? "",
    })),
    now,
    weekEnd,
  );

  return (
    <>
      <PageHeader title={team.name} description={`Team · ${team.members.length} members`} />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Team schedule"
            description="When everyone's busy over the next 7 days, in your timezone."
          />
          <CardBody>
            <TeamScheduleView schedule={schedule} timezone={viewerTz} rangeStart={now} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Members"
            description="Everyone whose availability counts for this team."
          />
          <CardBody className="space-y-4">
            <ul className="space-y-2">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-white">
                    {(m.user?.name ?? m.user?.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.user?.name ?? "Member"}</p>
                    <p className="text-xs text-[var(--color-muted)]">{m.user?.email}</p>
                  </div>
                </li>
              ))}
            </ul>
            <AddMemberForm teamId={team.id} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Team event types"
            description="Booking links that use the whole team's availability."
          />
          <CardBody className="space-y-5">
            {events.length > 0 ? (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {e.durationMinutes}m · {TYPE_LABEL[e.schedulingType] ?? e.schedulingType}
                      </p>
                    </div>
                    <Link
                      href={`/team/${team.slug}/${e.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
                    >
                      /team/{team.slug}/{e.slug} <ExternalLink size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <Users size={15} /> No team events yet — create one below.
              </p>
            )}
            <div className="border-t border-[var(--color-border)] pt-5">
              <CreateTeamEventForm teamId={team.id} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Scheduling rules"
            description="Company holidays and meeting-free windows that block bookings for every member."
          />
          <CardBody>
            <TeamRules
              teamId={team.id}
              canManage={canManage}
              initial={rules.map((r) => ({
                id: r.id,
                kind: r.kind,
                label: r.label,
                theDate: r.theDate,
                dayOfWeek: r.dayOfWeek,
                startMinute: r.startMinute,
                endMinute: r.endMinute,
              }))}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
