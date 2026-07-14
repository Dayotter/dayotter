"use client";

import { BookingMock, ReminderMock, TeamAvailabilityMock } from "@/components/marketing/mocks";
import { Reveal, Stagger } from "@/components/marketing/motion";
import { cn } from "@/lib/cn";
import { Sparkles } from "lucide-react";

function Card({
  className,
  title,
  body,
  children,
}: {
  className?: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Stagger.Item
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-raise)]",
        className,
      )}
    >
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>
      {children ? <div className="mt-5 flex-1">{children}</div> : null}
    </Stagger.Item>
  );
}

function ProviderChips() {
  const providers = [
    { name: "Google Calendar", hue: "var(--color-sky)" },
    { name: "Outlook 365", hue: "var(--color-accent)" },
    { name: "Apple iCloud", hue: "var(--color-muted)" },
  ];
  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <div
          key={p.name}
          className="flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.hue }} />
          {p.name}
          <span className="ml-auto text-xs text-[var(--color-mint)]">Synced</span>
        </div>
      ))}
    </div>
  );
}

function AIMock() {
  return (
    <div className="space-y-2.5">
      <div className="ml-auto w-fit max-w-[85%] rounded-[14px] rounded-br-sm bg-[var(--color-accent)] px-3.5 py-2 text-sm text-white">
        "Hold two hours for deep work tomorrow"
      </div>
      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <Sparkles size={13} className="text-[var(--color-accent)]" /> Draft - nothing's booked
          until you say so
        </div>
        <p className="mt-1.5 text-sm font-medium">Deep work · Tomorrow, 9:00–11:00 AM</p>
        <div className="mt-2.5 flex gap-2">
          <span className="rounded-sm bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white">
            Confirm
          </span>
          <span className="rounded-sm border border-[var(--color-border-strong)] px-3 py-1 text-xs">
            Edit
          </span>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Everything you need, nothing you don't</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          One calm home for your whole schedule.
        </h2>
      </Reveal>

      <Stagger className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
        <Card
          className="md:col-span-4 md:row-span-2"
          title="Ask Otter anything"
          body="“Book a call with Priya Thursday.” “Hold two hours for deep work.” “Move my 3pm.” Say it in plain words - Otter drafts it and waits for your OK. It never touches your calendar on its own."
        >
          <AIMock />
        </Card>

        <Card
          className="md:col-span-2"
          title="Every calendar, in sync"
          body="Google, Outlook and Apple - one source of truth."
        >
          <ProviderChips />
        </Card>

        <Card
          className="md:col-span-2"
          title="It covers for you"
          body="Otter holds focus time on quiet mornings, and quietly warns your next meeting when you're running behind."
        >
          <ReminderMock />
        </Card>

        <Card
          className="md:col-span-3"
          title="Let people book you"
          body="A booking page as calm as it is capable - buffers, intake questions, recurring meetings, instant video links."
        >
          <BookingMock />
        </Card>

        <Card
          className="md:col-span-3"
          title="Schedule as a team"
          body="Round-robin and collective booking, weighted your way. Routing forms send each visitor to the right person - never behind a paywall."
        >
          <TeamAvailabilityMock />
        </Card>
      </Stagger>
    </section>
  );
}
