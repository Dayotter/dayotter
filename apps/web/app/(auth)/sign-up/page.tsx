"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FieldError, FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { identify, track } from "@/lib/analytics";
import { signUp } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Field-level validation before hitting the API — clearer, faster feedback.
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    setPasswordError(null);
    setLoading(true);
    const { data, error } = await signUp.email({ name, email, password });
    setLoading(false);
    if (error) {
      track("Sign Up Failed");
      setError(
        error.message ?? "We couldn't create your account. That email may already be in use.",
      );
      return;
    }
    if (data?.user?.id) identify(data.user.id, { email, name });
    track("Signed Up");
    router.push("/dashboard");
  }

  return (
    <Card>
      <CardBody className="p-6">
        <h1 className="font-display text-[1.7rem] leading-tight tracking-[-0.01em]">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Start scheduling in minutes. Free and open-source.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={Boolean(passwordError)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="At least 8 characters"
            />
            <FieldError>{passwordError}</FieldError>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
