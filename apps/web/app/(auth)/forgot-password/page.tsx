"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setLoading(false);
    // Always show success — never reveal whether an email is registered.
    if (error && error.status !== 200) {
      // Only surface hard failures (network/500); not "no such account".
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">Check your email</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          If an account exists for <span className="text-[var(--color-text)]">{email}</span>, we've
          sent a link to reset your password. It expires in an hour.
        </p>
        <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
          <Link href="/sign-in" className="font-medium text-[var(--color-accent)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Enter your email and we'll send you a link to set a new password.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
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
        <FormError>{error}</FormError>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
        <Link href="/sign-in" className="font-medium text-[var(--color-accent)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
