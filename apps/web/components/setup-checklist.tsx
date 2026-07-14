import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

interface Step {
  done: boolean;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

/**
 * "Get bookable in 3 steps" - the new-user setup guide. Shown on the dashboard
 * until every step is done, then it disappears so the dashboard stays calm.
 * Purely presentational; the page computes the three booleans.
 */
export function SetupChecklist({
  hasCalendar,
  hasHours,
  hasEventType,
}: {
  hasCalendar: boolean;
  hasHours: boolean;
  hasEventType: boolean;
}) {
  const steps: Step[] = [
    {
      done: hasCalendar,
      title: "Connect your calendar",
      detail: "So we only ever offer times you're actually free.",
      href: "/settings/calendars",
      cta: "Connect",
    },
    {
      done: hasHours,
      title: "Set your hours",
      detail: "The window people can book you in.",
      href: "/availability",
      cta: "Set hours",
    },
    {
      done: hasEventType,
      title: "Create a booking type",
      detail: "A link people use to grab time - a 30-min intro, a demo, anything.",
      href: "/event-types",
      cta: "Create",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg leading-tight">Get set up to take bookings</h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">
            A couple of minutes and people can book you without the back-and-forth.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
          {doneCount} of {steps.length}
        </span>
      </div>

      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex items-center gap-3 rounded-lg bg-[var(--color-surface)] px-4 py-3"
          >
            <span
              className={
                s.done
                  ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)] text-white"
                  : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-xs font-semibold text-[var(--color-muted)]"
              }
            >
              {s.done ? <Check size={14} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={
                  s.done
                    ? "text-sm font-medium text-[var(--color-muted)] line-through"
                    : "text-sm font-medium"
                }
              >
                {s.title}
              </p>
              {!s.done ? <p className="text-xs text-[var(--color-muted)]">{s.detail}</p> : null}
            </div>
            {!s.done ? (
              <Link
                href={s.href}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                {s.cta} <ArrowRight size={14} />
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
