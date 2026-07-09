import { SlotPicker } from "@/components/slot-picker";
import { Card, CardBody } from "@/components/ui/card";
import { and, eq, getDb, schema } from "@calsync/db";
import { Clock, Users, Video } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  collective: "Meet the whole team",
  round_robin: "You'll be matched with an available host",
};

export default async function TeamBookingPage({
  params,
}: {
  params: Promise<{ teamSlug: string; slug: string }>;
}) {
  const { teamSlug, slug } = await params;
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.slug, teamSlug),
    with: { members: { with: { user: true } } },
  });
  if (!team) notFound();

  const eventType = await db.query.eventTypes.findFirst({
    where: and(
      eq(schema.eventTypes.teamId, team.id),
      eq(schema.eventTypes.slug, slug),
      eq(schema.eventTypes.isActive, true),
    ),
  });
  if (!eventType) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="border-b border-[var(--color-border)] p-6 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Users size={17} />
              </div>
              <span className="text-sm text-[var(--color-muted)]">{team.name}</span>
            </div>
            <h1 className="font-display mt-4 text-2xl leading-tight tracking-[-0.01em]">
              {eventType.title}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {TYPE_LABEL[eventType.schedulingType] ?? ""}
            </p>

            {/* Host avatars */}
            <div className="mt-4 flex -space-x-2">
              {team.members.slice(0, 5).map((m) => (
                <div
                  key={m.id}
                  title={m.user?.name ?? m.user?.email ?? ""}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-accent)] text-xs font-semibold text-white"
                >
                  {(m.user?.name ?? m.user?.email ?? "?").charAt(0).toUpperCase()}
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm text-[var(--color-muted)]">
              <p className="flex items-center gap-2">
                <Clock size={15} /> {eventType.durationMinutes} minutes
              </p>
              <p className="flex items-center gap-2">
                <Video size={15} /> Google Meet
              </p>
            </div>
          </div>

          <CardBody className="p-6">
            <h2 className="mb-4 text-sm font-semibold">Select a time</h2>
            <SlotPicker
              eventTypeId={eventType.id}
              defaultDuration={eventType.durationMinutes}
              durationOptions={eventType.durationOptions ?? []}
            />
          </CardBody>
        </div>
      </Card>
      <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
        Powered by <span className="text-[var(--color-muted)]">calSync</span>
      </p>
    </main>
  );
}
