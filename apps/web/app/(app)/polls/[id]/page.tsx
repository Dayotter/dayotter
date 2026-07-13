import { PageHeader } from "@/components/page-header";
import { type PollOptionResult, PollResults } from "@/components/poll-results";
import { getSession } from "@/lib/auth/session";
import { getPollForHost } from "@/lib/polls/polls";
import { DateTime } from "luxon";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PollResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";
  const poll = await getPollForHost(id, session!.user.id);
  if (!poll) notFound();

  const appHost = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const shareUrl = `${appHost}/poll/${poll.token}`;

  const options: PollOptionResult[] = poll.options.map((o) => {
    const votes = poll.votes.filter((v) => v.optionId === o.id);
    return {
      id: o.id,
      label: DateTime.fromJSDate(o.startsAt).setZone(tz).toFormat("ccc, LLL d · h:mm a"),
      yes: votes.filter((v) => v.response === "yes").length,
      maybe: votes.filter((v) => v.response === "maybe").length,
      no: votes.filter((v) => v.response === "no").length,
      voters: votes.map((v) => ({ name: v.voterName, response: v.response })),
    };
  });

  const uniqueVoters = new Set(poll.votes.map((v) => v.voterEmail)).size;

  return (
    <>
      <PageHeader
        eyebrow="Group poll"
        title={poll.title}
        description={
          poll.status === "finalized"
            ? "Finalized — the time is on your calendar and everyone's been notified."
            : `${uniqueVoters} ${uniqueVoters === 1 ? "person has" : "people have"} voted so far.`
        }
      />
      <Link
        href="/polls"
        className="mb-4 inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        ← All polls
      </Link>
      <PollResults
        pollId={poll.id}
        shareUrl={shareUrl}
        sharePath={`/poll/${poll.token}`}
        status={poll.status}
        options={options}
        finalizedOptionId={poll.finalizedOptionId}
      />
    </>
  );
}
