const BADGES = [
  { img: "/brand/illustrations/badge-scheduling.png", label: "Easy scheduling" },
  { img: "/brand/illustrations/badge-secure.png", label: "Secure & private" },
  { img: "/brand/illustrations/badge-balance.png", label: "Work–life balance" },
  { img: "/brand/illustrations/badge-timezone.png", label: "Timezone-friendly" },
  { img: "/brand/illustrations/badge-reminders.png", label: "Smart reminders" },
  { img: "/brand/illustrations/badge-track.png", label: "Stay on track" },
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
            <img src={b.img} alt="" className="h-20 w-20 sm:h-24 sm:w-24" />
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
