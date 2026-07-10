import type { ReactNode } from "react";

/**
 * Centered page header for marketing pages, with an ambient accent wash to match
 * the auth/landing hero treatment.
 */
export function MarketingHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-[0.12]"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, var(--color-accent) 0%, transparent 65%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
        {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
        <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.01em] sm:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Long-form content container (legal, about, docs, blog posts). Styles headings,
 * paragraphs, lists, and links on-theme without a Tailwind typography plugin.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto max-w-2xl px-6 py-16 text-[15px] leading-7 text-[var(--color-muted)]
        [&_a]:text-[var(--color-accent)] [&_a:hover]:underline
        [&_h2]:font-display [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:tracking-[-0.01em] [&_h2]:text-[var(--color-text)]
        [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[var(--color-text)]
        [&_p]:mb-4
        [&_strong]:font-semibold [&_strong]:text-[var(--color-text)]
        [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
        [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5
        [&_hr]:my-10 [&_hr]:border-[var(--color-border)]
        [&_code]:rounded [&_code]:bg-[var(--color-surface-2)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[var(--color-text)]"
    >
      {children}
    </div>
  );
}
