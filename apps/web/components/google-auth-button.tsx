"use client";

import { track } from "@/lib/analytics";
import { signIn } from "@/lib/auth/auth-client";
import { useState } from "react";

/** Whether the server has Google sign-in configured (operator sets this alongside GOOGLE_CLIENT_ID). */
const enabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";

/** "Continue with Google" social sign-in. Renders nothing unless enabled. */
export function GoogleAuthButton({ label = "Continue with Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  if (!enabled) return null;

  async function go() {
    setLoading(true);
    track("Google Auth Started");
    await signIn.social({ provider: "google", callbackURL: "/dashboard" });
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-60"
      >
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.7 2.5-7.6 2.5-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C41.9 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z"
          />
        </svg>
        {loading ? "Redirecting…" : label}
      </button>
      <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-faint)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </>
  );
}
