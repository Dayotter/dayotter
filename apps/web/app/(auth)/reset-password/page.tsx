"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Better Auth redirects here with the capability token in the query. An
  // `error` param means the link was invalid or expired.
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");
    if (!token) return setError("This reset link is invalid. Request a new one.");

    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't reset your password. The link may have expired.");
      return;
    }
    router.push("/sign-in?reset=1");
  }

  if (linkError || (!token && !loading)) {
    return (
      <div>
        <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">Link expired</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This password reset link is invalid or has expired. Request a fresh one.
        </p>
        <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">Set a new password</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Choose a new password for your account.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
