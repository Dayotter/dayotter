import { PollVoteForm } from "@/components/poll-vote-form";
import { Card, CardBody } from "@/components/ui/card";
import { getPollByToken } from "@/lib/polls/polls";
import { CalendarCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const poll = await getPollByToken((await params).token);
  return { title: poll ? `Vote: ${poll.title} — DayOtter` : "Poll — DayOtter" };
}

export default async function PublicPollPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const poll = await getPollByToken(token);
  if (!poll) notFound();

  const finalized = poll.status === "finalized";
  const finalOption = poll.options.find((o) => o.id === poll.finalizedOptionId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <p className="eyebrow mb-2">{poll.host?.name ? `${poll.host.name} · ` : ""}Group poll</p>
          <h1 className="font-display text-2xl leading-tight tracking-[-0.01em]">{poll.title}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
            <Clock size={15} /> {poll.durationMinutes} minutes
          </p>

          <div className="mt-6">
            {finalized ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.06] p-6 text-center">
                <CalendarCheck className="mx-auto mb-2 text-[var(--color-success)]" size={28} />
                <p className="font-medium">The time is set</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {finalOption
                    ? new Date(finalOption.startsAt).toUTCString().replace(" GMT", " UTC")
                    : "The organizer has picked a time."}
                </p>
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  Your calendar invite has the exact time in your timezone.
                </p>
              </div>
            ) : (
              <PollVoteForm
                token={token}
                options={poll.options.map((o) => ({
                  id: o.id,
                  startISO: o.startsAt.toISOString(),
                }))}
              />
            )}
          </div>
        </CardBody>
      </Card>
      <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
        Powered by{" "}
        <Link href="/" className="hover:text-[var(--color-text)]">
          DayOtter
        </Link>
      </p>
    </main>
  );
}
