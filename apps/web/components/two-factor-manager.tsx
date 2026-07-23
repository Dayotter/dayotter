"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { twoFactor } from "@/lib/auth/auth-client";
import { CheckCircle2, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "idle" | "password" | "setup" | "disable" | "regen";

/** Extract the base32 secret from an otpauth:// URI for manual authenticator entry. */
function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function CodeList({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--color-muted)]">
          Recovery codes - store them somewhere safe. Each works once.
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(codes.join("\n")).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
        >
          <Copy size={12} /> {copied ? "Copied" : "Copy all"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
    </div>
  );
}

export function TwoFactorManager({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setMode("idle");
    setPassword("");
    setCode("");
    setSecret("");
    setBackupCodes([]);
    setError(null);
  }

  // Step 1: password → enable → returns the TOTP secret + recovery codes.
  async function beginEnable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await twoFactor.enable({ password });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? "Couldn't start setup. Check your password.");
      return;
    }
    setSecret(secretFromUri(res.data.totpURI));
    setBackupCodes(res.data.backupCodes ?? []);
    setPassword("");
    setMode("setup");
  }

  // Step 2: verify a code from the app to finish turning 2FA on.
  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "That code didn't match. Try again.");
      return;
    }
    reset();
    router.refresh();
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await twoFactor.disable({ password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Couldn't disable. Check your password.");
      return;
    }
    reset();
    router.refresh();
  }

  async function confirmRegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await twoFactor.generateBackupCodes({ password });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message ?? "Couldn't regenerate. Check your password.");
      return;
    }
    setBackupCodes(res.data.backupCodes ?? []);
    setPassword("");
    setMode("idle");
  }

  // ---- Setup flow (after enable): show the secret + codes, then verify. ----
  if (mode === "setup") {
    return (
      <form onSubmit={confirmEnable} className="space-y-4">
        <div>
          <p className="text-sm font-medium">1. Add DayOtter to your authenticator app</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            In Google Authenticator, 1Password, Authy, etc., add an account by entering this setup
            key manually:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-sm tracking-wider">
              {secret}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(secret)}
              className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
              aria-label="Copy setup key"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">2. Save your recovery codes</p>
          <div className="mt-2">
            <CodeList codes={backupCodes} />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">3. Confirm with a code</p>
          <Input
            id="totp"
            aria-label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="mt-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>

        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Turn on 2FA"}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  // ---- Password prompts (enable / disable / regenerate) ----
  if (mode === "password" || mode === "disable" || mode === "regen") {
    const onSubmit =
      mode === "password" ? beginEnable : mode === "disable" ? confirmDisable : confirmRegen;
    const cta =
      mode === "password" ? "Continue" : mode === "disable" ? "Turn off 2FA" : "Regenerate codes";
    return (
      <form onSubmit={onSubmit} className="max-w-sm space-y-3">
        <div>
          <Label htmlFor="pw">Confirm your password</Label>
          <Input
            id="pw"
            type="password"
            autoComplete="current-password"
            className="mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={busy}
            variant={mode === "disable" ? "outline" : "primary"}
          >
            {busy ? "Working…" : cta}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  // ---- Idle: status + entry points ----
  // Freshly regenerated codes to surface once.
  if (backupCodes.length > 0 && enabled) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={15} /> New recovery codes generated. Your old codes no longer work.
        </p>
        <CodeList codes={backupCodes} />
        <Button variant="outline" onClick={() => setBackupCodes([])}>
          Done
        </Button>
      </div>
    );
  }

  return enabled ? (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-[var(--color-success)]">
        <ShieldCheck size={16} /> Two-factor authentication is on.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setMode("regen")}>
          Regenerate recovery codes
        </Button>
        <Button variant="ghost" onClick={() => setMode("disable")} className="gap-1.5">
          <ShieldOff size={15} /> Turn off
        </Button>
      </div>
    </div>
  ) : (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Add a second step at sign-in with an authenticator app (TOTP). You'll get one-time recovery
        codes in case you lose your device.
      </p>
      <Button onClick={() => setMode("password")}>Enable two-factor auth</Button>
    </div>
  );
}
