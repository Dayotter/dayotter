import { PageHeader } from "@/components/page-header";
import { PollCreateForm } from "@/components/poll-create-form";

export const dynamic = "force-dynamic";

export default function NewPollPage() {
  return (
    <>
      <PageHeader
        eyebrow="Group poll"
        title="Find a time"
        description="Propose a few times, then use a public link or email personal voting links. You pick the winner."
      />
      <PollCreateForm />
    </>
  );
}
