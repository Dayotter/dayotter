"use client";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { PhoneAuthPanel } from "@/components/phone-auth-panel";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { identify, track } from "@/lib/analytics";
import { signIn, twoFactor } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Second step: shown when the account has 2FA enabled and sign-in needs a code.
  const [twoFactorStep, setTwoFactorStep] = useState(false);

  function finishSignIn() {
    track("Signed In");
    router.push("/dashboard");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) {
      track("Sign In Failed");
      setError(
        error.message ?? "We couldn't sign you in. Check your email and password and try again.",
      );
      return;
    }
    // 2FA on: don't have a session yet - collect the authenticator code.
    if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setTwoFactorStep(true);
      return;
    }
    if (data?.user?.id) identify(data.user.id, { email });
    finishSignIn();
  }

  if (twoFactorStep) {
    return <TwoFactorStep onDone={finishSignIn} onBack={() => setTwoFactorStep(false)} />;
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">Welcome back</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Sign in to your DayOtter account.</p>

      <div className="mt-7 space-y-3">
        <GoogleAuthButton label="Continue with Google" />
        <PhoneAuthPanel />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        New to DayOtter?{" "}
        <Link href="/sign-up" className="font-medium text-[var(--color-accent)] hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

/** Second sign-in step for accounts with 2FA on: an authenticator code, or a
 *  one-time recovery code as a fallback. */
function TwoFactorStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = useBackup
      ? await twoFactor.verifyBackupCode({ code: code.trim() })
      : await twoFactor.verifyTotp({ code: code.trim(), trustDevice });
    setLoading(false);
    if (res.error) {
      track("Sign In Failed");
      setError(
        res.error.message ??
          (useBackup ? "That recovery code didn't match." : "That code didn't match. Try again."),
      );
      return;
    }
    onDone();
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">Two-factor auth</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        {useBackup
          ? "Enter one of your saved recovery codes."
          : "Enter the 6-digit code from your authenticator app."}
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <Label htmlFor="code">{useBackup ? "Recovery code" : "Authenticator code"}</Label>
          <Input
            id="code"
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={useBackup ? "xxxx-xxxx" : "123456"}
          />
        </div>
        {!useBackup ? (
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
            />
            Trust this device for 60 days
          </label>
        ) : null}
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setUseBackup((v) => !v);
            setCode("");
            setError(null);
          }}
          className="font-medium text-[var(--color-accent)] hover:underline"
        >
          {useBackup ? "Use an authenticator code" : "Use a recovery code"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          Back
        </button>
      </div>
    </div>
  );
}
