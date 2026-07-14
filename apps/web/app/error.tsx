"use client";

import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-6 text-center">
      {/* biome-ignore lint/a11y/useAltText: decorative illustration */}
      <img
        src="/brand/illustrations/otter-focus.png"
        alt=""
        className="mb-8 h-44 w-44 object-contain sm:h-52 sm:w-52"
      />
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Something slipped.</h1>
      <p className="mt-3 max-w-sm leading-relaxed text-[var(--color-muted)]">
        An unexpected error washed up. The otter's on it - try again in a moment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          Try again
        </button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Back home
        </Link>
      </div>
    </main>
  );
}
