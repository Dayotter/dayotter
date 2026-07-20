import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { Marquee } from "@/components/marketing/marquee";
import { MobileApps } from "@/components/marketing/mobile";
import { MarketingNav } from "@/components/marketing/nav";
import { CTA, FAQ, Footer, HowItWorks, Manifesto, Shift } from "@/components/marketing/sections";
import { CompareTeaser, DayWithOtter, OtterDemo } from "@/components/marketing/showcase";
import { OtterBand, WhyOtter } from "@/components/marketing/why";

export default function HomePage() {
  return (
    <div className="grain relative">
      <MarketingNav />
      <main className="relative z-10 pt-14">
        <Hero />
        {/* The demo sits high on purpose: it's the first thing that shows the
            product doing the job, rather than describing it. */}
        <OtterDemo />
        <Marquee />
        <Features />
        <Shift />
        <WhyOtter />
        <DayWithOtter />
        <MobileApps />
        <HowItWorks />
        <CompareTeaser />
        <Manifesto />
        <OtterBand />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
