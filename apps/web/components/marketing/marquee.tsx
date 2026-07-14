const WORKS_WITH = [
  "Google Calendar",
  "Outlook",
  "Apple iCloud",
  "Google Meet",
  "Zoom",
  "Microsoft Teams",
  "Slack",
  "Stripe",
];

/** Infinite logo/word marquee - social proof of integrations. */
export function Marquee() {
  const row = [...WORKS_WITH, ...WORKS_WITH];
  return (
    <div className="relative overflow-hidden py-6">
      <p className="eyebrow mb-6 text-center">Plays nice with the calendars you already use</p>
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        <div className="flex w-max animate-marquee items-center gap-6">
          {row.map((name, i) => (
            <span key={i} className="flex items-center gap-6">
              <span className="whitespace-nowrap text-lg font-medium text-[var(--color-faint)]">
                {name}
              </span>
              <span aria-hidden className="text-[var(--color-border-strong)]">
                &bull;
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
