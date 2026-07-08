"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
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
        error.message ??
          "We couldn't sign you in. Check your email and password and try again.",
      );
      return;
    }
    if (data?.user?.id) identify(data.user.id, { email });
    track("Signed In");
    router.push("/dashboard");
  }

  return (
    <Card>
      <CardBody className="p-6">
        <h1 className="font-display text-[1.7rem] leading-tight tracking-[-0.01em]">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Sign in to your calSync account.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            <Label htmlFor="password">Password</Label>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
          No account?{" "}
          <Link href="/sign-up" className="text-[var(--color-accent)] hover:underline">
            Create one
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
