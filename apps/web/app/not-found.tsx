import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-6 text-center">
      {/* biome-ignore lint/a11y/useAltText: decorative illustration */}
      <img
        src="/brand/illustrations/otter-relax.png"
        alt=""
        className="mb-8 h-44 w-44 object-contain sm:h-52 sm:w-52"
      />
      <p className="eyebrow">404</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight sm:text-5xl">
        This page drifted off.
      </h1>
      <p className="mt-3 max-w-sm leading-relaxed text-[var(--color-muted)]">
        The otter looked everywhere and couldn't find it. Let's get you back to calmer waters.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Back home
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Go to the app
        </Link>
      </div>
    </main>
  );
}
