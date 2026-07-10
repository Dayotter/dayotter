import { MarketingNav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/sections";
import type { ReactNode } from "react";

/** Shared chrome for every public marketing page (pricing, legal, blog, …). */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grain relative min-h-screen">
      <MarketingNav />
      <main className="relative z-10 pt-14">{children}</main>
      <Footer />
    </div>
  );
}
