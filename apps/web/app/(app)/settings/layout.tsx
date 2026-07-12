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
      <SettingsNav />
      {children}
    </>
  );
}
