import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings-nav";
import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your account, preferences, and calendars."
      />
      <div className="lg:grid lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-10">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
