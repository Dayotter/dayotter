"use client";

import { GoogleAuthButton } from "@/components/google-auth-button";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { identify, track } from "@/lib/analytics";
import { signIn } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (data?.user?.id) identify(data.user.id, { email });
    track("Signed In");
    router.push("/dashboard");
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight tracking-[-0.01em]">Welcome back</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">Sign in to your DayOtter account.</p>

      <div className="mt-7">
        <GoogleAuthButton label="Continue with Google" />
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
