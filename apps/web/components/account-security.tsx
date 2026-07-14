"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountSecurity() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOutOthers() {
    setSigningOut(true);
    await authClient.revokeOtherSessions().catch(() => {});
    setSigningOut(false);
    setSignedOut(true);
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    const res = await authClient.deleteUser();
    setDeleting(false);
    if (res.error) {
      setError(res.error.message ?? "Could not delete your account. Please try again.");
      return;
    }
    router.push("/");
  }

  return (
    <div className="mt-8 space-y-8">
      <section>
        <h2 className="text-sm font-semibold">Active sessions</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Signed in somewhere you don't recognize? Sign out of every device except this one.
        </p>
        <Button variant="outline" className="mt-3" onClick={signOutOthers} disabled={signingOut}>
          {signingOut
            ? "Signing out…"
            : signedOut
              ? "Other devices signed out ✓"
              : "Sign out other devices"}
        </Button>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-danger)]">Delete account</h2>
        <p className="mt-1 max-w-lg text-sm text-[var(--color-muted)]">
          Permanently delete your account and everything in it - bookings, booking types, connected
          calendars, and settings. This can't be undone.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder='Type "delete" to confirm'
            className="h-9 w-56 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
          />
          <button
            type="button"
            onClick={deleteAccount}
            disabled={confirm.trim().toLowerCase() !== "delete" || deleting}
            className="h-9 rounded-md bg-[var(--color-danger)] px-4 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p> : null}
      </section>
    </div>
  );
}
