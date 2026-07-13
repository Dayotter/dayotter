import { AppNav } from "@/components/app-nav";
import { MobileNav } from "@/components/mobile-nav";
import { OtterLauncher } from "@/components/otter-launcher";
import { ToastProvider } from "@/components/ui/toast";
import { aiEnabled } from "@/lib/ai/llm";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  return (
    <ToastProvider>
      <div className="grain relative flex min-h-screen">
        <AppNav user={{ name: session.user.name, email: session.user.email }} />
        <MobileNav />
        <main className="relative flex-1 overflow-y-auto">
          {/* Subtle ambient wash so the app inherits the marketing atmosphere
            instead of dying at flat ivory — far fainter than the hero (6% vs 22%). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--color-accent) 6%, transparent), transparent 72%)",
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
  );
}
