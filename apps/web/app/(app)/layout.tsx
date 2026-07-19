import { AppNav } from "@/components/app-nav";
import { MobileNav } from "@/components/mobile-nav";
import { OtterLauncher } from "@/components/otter-launcher";
import { TimezoneSync } from "@/components/timezone-sync";
import { ToastProvider } from "@/components/ui/toast";
import { aiEnabled } from "@/lib/ai/llm";
import { getSession } from "@/lib/auth/session";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { resolveUserLocale } from "@/lib/i18n/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");
  // Server-resolve the locale so client components (Otter chrome) render the same
  // language on the server and the client - no hydration mismatch. An explicit
  // stored language preference wins over the browser's Accept-Language header.
  const locale = await resolveUserLocale(session.user.id, (await headers()).get("accept-language"));

  return (
    <LocaleProvider locale={locale}>
      <ToastProvider>
        <TimezoneSync />
        <div className="grain relative flex h-[100dvh] overflow-hidden">
          <AppNav user={{ name: session.user.name, email: session.user.email }} />
          <MobileNav />
          <main className="relative flex-1 overflow-y-auto">
            {/* Ambient wash so the app inherits the marketing atmosphere instead of
            dying at flat ivory. Two offset accent glows read fuller than a single
            faint radial without shouting like the hero. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[34rem]"
              style={{
                background:
                  "radial-gradient(80% 70% at 18% -8%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 56%), radial-gradient(72% 62% at 96% 0%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 58%)",
              }}
            />
            {/* Top/bottom padding on mobile clears the fixed top bar + bottom tab bar. */}
            <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-[70px] sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
              {children}
            </div>
          </main>
        </div>
        {aiEnabled ? <OtterLauncher /> : null}
      </ToastProvider>
    </LocaleProvider>
  );
}
