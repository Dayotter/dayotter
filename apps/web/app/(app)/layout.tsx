import { AppNav } from "@/components/app-nav";
import { MobileNav } from "@/components/mobile-nav";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex min-h-screen">
      <AppNav user={{ name: session.user.name, email: session.user.email }} />
      <MobileNav />
      <main className="flex-1 overflow-y-auto">
        {/* Top/bottom padding on mobile clears the fixed top bar + bottom tab bar. */}
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-[70px] sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
