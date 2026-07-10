import { MarketingHeader } from "@/components/marketing/page-shell";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status — calSync",
  description: "calSync system status.",
};

const SYSTEMS = ["Web app", "Booking API", "Calendar sync", "Reminders & notifications", "Payments"];

export default function StatusPage() {
  return (
    <>
      <MarketingHeader eyebrow="Status" title="System status" />
      <section className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-6 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3">
          <CheckCircle2 size={18} className="text-[var(--color-success)]" />
          <span className="font-medium text-[var(--color-success)]">All systems operational</span>
        </div>
        <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          {SYSTEMS.map((s) => (
            <li key={s} className="flex items-center justify-between px-4 py-3.5 text-sm">
              <span>{s}</span>
              <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> Operational
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
          Self-hosting calSync? This page reflects the hosted cloud only.
        </p>
      </section>
    </>
  );
}
