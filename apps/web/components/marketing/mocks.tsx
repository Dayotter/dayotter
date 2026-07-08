import { Check, Video } from "lucide-react";

/*
 * High-fidelity product mockups used as the marketing "imagery".
 * Pure presentational components built from the design tokens.
 */

const HUES = {
  violet: "var(--color-accent)",
  mint: "var(--color-mint)",
  amber: "var(--color-amber)",
  coral: "var(--color-coral)",
  sky: "var(--color-sky)",
} as const;
type Hue = keyof typeof HUES;

function soft(hue: Hue) {
  return `color-mix(in srgb, ${HUES[hue]} 14%, var(--color-surface))`;
}

interface Ev {
  day: number; // 0..4 (Mon..Fri)
  start: number; // hour, 9..15
  end: number;
  title: string;
  hue: Hue;
}

const EVENTS: Ev[] = [
  { day: 0, start: 9.5, end: 10.5, title: "Standup", hue: "violet" },
  { day: 0, start: 13, end: 14, title: "Design sync", hue: "amber" },
  { day: 1, start: 10, end: 11, title: "1:1 · Dana", hue: "mint" },
  { day: 1, start: 14.5, end: 15.5, title: "Interview", hue: "coral" },
  { day: 2, start: 9, end: 10, title: "Focus", hue: "sky" },
  { day: 2, start: 12, end: 13.5, title: "Roadmap", hue: "violet" },
  { day: 3, start: 11, end: 12, title: "Intro call", hue: "mint" },
  { day: 4, start: 10.5, end: 12, title: "Workshop", hue: "amber" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START_HOUR = 9;
const END_HOUR = 16;
const ROW = 34; // px per hour

/** A polished week calendar view — the flagship product visual. */
export function CalendarMock({ className }: { className?: string }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const bodyHeight = (END_HOUR - START_HOUR) * ROW;

  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-float)] ${className ?? ""}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: HUES.coral }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: HUES.amber }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: HUES.mint }} />
        </div>
        <span className="text-sm font-medium">This week</span>
        <span className="text-xs text-[var(--color-muted)]">Jul 7 – 11</span>
      </div>

      {/* Day headers */}
      <div className="grid" style={{ gridTemplateColumns: "36px repeat(5, 1fr)" }}>
        <div />
        {DAYS.map((d, i) => (
          <div key={d} className="px-2 py-2 text-center">
            <div className="text-[11px] text-[var(--color-muted)]">{d}</div>
            <div className={`text-sm font-medium ${i === 2 ? "text-[var(--color-accent)]" : ""}`}>
              {7 + i}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid" style={{ gridTemplateColumns: "36px repeat(5, 1fr)" }}>
        <div className="relative" style={{ height: bodyHeight }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-1.5 text-[10px] text-[var(--color-faint)]"
              style={{ top: i * ROW - 6 }}
            >
              {h > 12 ? h - 12 : h}
              {h >= 12 ? "p" : "a"}
            </div>
          ))}
        </div>
        {DAYS.map((_, day) => (
          <div
            key={day}
            className="relative border-l border-[var(--color-border)]"
            style={{ height: bodyHeight }}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-[var(--color-border)]/70"
                style={{ top: i * ROW }}
              />
            ))}
            {EVENTS.filter((e) => e.day === day).map((e, idx) => (
              <div
                key={idx}
                className="absolute inset-x-1 overflow-hidden rounded-[7px] px-2 py-1 text-[11px] leading-tight"
                style={{
                  top: (e.start - START_HOUR) * ROW + 1,
                  height: (e.end - e.start) * ROW - 2,
                  background: soft(e.hue),
                  borderLeft: `2.5px solid ${HUES[e.hue]}`,
                }}
              >
                <div className="font-medium text-[var(--color-text)]">{e.title}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Team availability overlap — the "find a time we're all free" wedge. */
export function TeamAvailabilityMock({ className }: { className?: string }) {
  const people: { name: string; hue: Hue; busy: [number, number][] }[] = [
    {
      name: "Archit",
      hue: "violet",
      busy: [
        [0, 22],
        [58, 78],
      ],
    },
    {
      name: "Dana",
      hue: "mint",
      busy: [
        [10, 30],
        [70, 100],
      ],
    },
    {
      name: "Sam",
      hue: "amber",
      busy: [
        [0, 12],
        [30, 44],
        [82, 100],
      ],
    },
  ];
  // Free-for-all window ~ 44%..58%
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-raise)] ${className ?? ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Team availability</span>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
          All free · 2:00 PM
        </span>
      </div>
      <div className="relative space-y-2.5">
        {/* highlighted common-free band */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
          style={{ left: "44%", width: "14%" }}
        />
        {people.map((p) => (
          <div key={p.name} className="flex items-center gap-3">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: HUES[p.hue] }}
            >
              {p.name[0]}
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-[var(--color-surface-2)]">
              {p.busy.map(([l, r], i) => (
                <div
                  key={i}
                  className="absolute inset-y-0 bg-[var(--color-border-strong)]"
                  style={{ left: `${l}%`, width: `${r - l}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A compact booking card. */
export function BookingMock({ className }: { className?: string }) {
  const times = ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"];
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-raise)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-white">
          A
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Intro Call</p>
          <p className="text-xs text-[var(--color-muted)]">30 min</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
          <Video size={13} /> Meet
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {times.map((t, i) => (
          <div
            key={t}
            className={
              i === 3
                ? "rounded-sm bg-[var(--color-accent)] py-1.5 text-center text-xs font-medium text-white"
                : "rounded-sm border border-[var(--color-border-strong)] py-1.5 text-center text-xs"
            }
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A reminder notification toast. */
export function ReminderMock({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-[var(--shadow-raise)] ${className ?? ""}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-accent)] text-white">
        <Check size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">Reminder · in 1 hour</p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          Intro Call with Dana — Join on Google Meet
        </p>
      </div>
    </div>
  );
}
