import { Reveal } from "@/components/marketing/motion";

/**
 * A short, narrated product demo. Click-to-play (the clip has voiceover, so we
 * never autoplay with sound); `preload="none"` keeps the 2.7MB off the initial
 * load until someone actually hits play. The poster is a real frame of the app.
 */
export function DemoVideo() {
  return (
    <section
      id="demo"
      className="scroll-mt-20 border-y border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="mx-auto max-w-5xl px-6 py-24">
        <Reveal>
          <div className="text-center">
            <span className="eyebrow">Watch the demo</span>
            <h2 className="font-display mt-4 text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl">
              See DayOtter in <em className="text-[var(--color-accent)]">about a minute.</em>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
              From a shared booking link to Otter moving a call - and waiting for your OK before
              anything changes.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <figure className="mt-10 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-float)]">
            {/* biome-ignore lint/a11y/useMediaCaption: narrated product demo; no caption track yet */}
            <video
              className="aspect-video w-full bg-[var(--color-bg)]"
              controls
              preload="none"
              poster="/demo/demo-poster.jpg"
            >
              <source src="/demo/dayotter-demo.mp4" type="video/mp4" />
              Your browser can't play this video.{" "}
              <a href="/demo/dayotter-demo.mp4">Download it instead.</a>
            </video>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
