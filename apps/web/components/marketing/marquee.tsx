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

/** Infinite logo/word marquee — social proof of integrations. */
export function Marquee() {
  const row = [...WORKS_WITH, ...WORKS_WITH];
  return (
    <div className="relative overflow-hidden py-6">
      <p className="eyebrow mb-6 text-center">Works with the calendars you already use</p>
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        <div className="flex w-max animate-marquee gap-10">
          {row.map((name, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-lg font-medium text-[var(--color-faint)]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
