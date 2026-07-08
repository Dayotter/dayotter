import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { Marquee } from "@/components/marketing/marquee";
import { MobileApps } from "@/components/marketing/mobile";
import { MarketingNav } from "@/components/marketing/nav";
import { CTA, Footer, HowItWorks, Manifesto } from "@/components/marketing/sections";

export default function HomePage() {
  return (
    <div className="grain relative">
      <MarketingNav />
      <main className="relative z-10 pt-14">
        <Hero />
        <Marquee />
        <Features />
        <MobileApps />
        <HowItWorks />
        <Manifesto />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
