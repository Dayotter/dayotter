const BADGES = [
  { img: "/brand/illustrations/badge-scheduling.png", label: "One link, done" },
  { img: "/brand/illustrations/badge-secure.png", label: "Yours to self-host" },
  { img: "/brand/illustrations/badge-balance.png", label: "Focus, protected" },
  { img: "/brand/illustrations/badge-timezone.png", label: "Every timezone" },
  { img: "/brand/illustrations/badge-reminders.png", label: "Reminders that fire" },
  { img: "/brand/illustrations/badge-track.png", label: "Never double-booked" },
];

/** A playful badge strip — the otter's take on "why DayOtter". */
export function WhyOtter() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Why DayOtter</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          Scheduling that keeps you calm.
        </h2>
      </div>
      <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
        {BADGES.map((b) => (
          <div key={b.label} className="flex flex-col items-center text-center">
            {/* biome-ignore lint/a11y/useAltText: decorative badge */}
            <img src={b.img} alt="" className="h-24 w-24 sm:h-28 sm:w-28" />
            <span className="mt-3 text-sm font-medium">{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Full-width otter banner — a warm closing note before the final CTA. */
export function OtterBand() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* biome-ignore lint/a11y/useAltText: decorative banner */}
      <img
        src="/brand/illustrations/otter-banner.png"
        alt=""
        className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-card)]"
      />
    </div>
  );
}
