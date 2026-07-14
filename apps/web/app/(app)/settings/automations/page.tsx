import { AutomationsForm } from "@/components/automations-form";
import { ProGate } from "@/components/upgrade-prompt";
import { WorkflowsForm } from "@/components/workflows-form";

export const dynamic = "force-dynamic";

/**
 * Automations — one home for every "when X, do Y" rule. Two coherent sections:
 * scheduling rules (reserve time / hold focus blocks) and attendee messages
 * (before/after-event emails). Previously these were two separate settings pages
 * (Automations + Workflows) that users conflated; unified here.
 */
export default function AutomationsSettingsPage() {
  return (
    <ProGate feature="automation">
      <div className="flex flex-col gap-10">
        <section>
          <h2 className="text-lg font-semibold">Scheduling rules</h2>
          <p className="mb-4 mt-1 text-sm text-[var(--color-muted)]">
            Reserve prep time and buffers around your bookings, and hold recurring focus blocks.
          </p>
          <AutomationsForm />
        </section>

        <section id="messages">
          <h2 className="text-lg font-semibold">Attendee messages</h2>
          <p className="mb-4 mt-1 text-sm text-[var(--color-muted)]">
            Send automated emails before and after a meeting — reminders and follow-ups, on your own
            templates.
          </p>
          <WorkflowsForm />
        </section>
      </div>
    </ProGate>
  );
}
