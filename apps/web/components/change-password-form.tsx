"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/auth-client";
import { Check } from "lucide-react";
import { useState } from "react";

/** Change the signed-in user's password (revokes other sessions on success). */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (next !== confirm) return setError("Those passwords don't match.");

    setLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't update your password. Check your current password.");
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <Card className="mt-6 max-w-xl">
      <CardHeader title="Password" description="Change the password you use to sign in." />
      <CardBody className="p-6 pt-0">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cur-pw">Current password</Label>
            <Input
              id="cur-pw"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-pw">New password</Label>
            <Input
              id="new-pw"
              type="password"
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input
              id="confirm-pw"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <FormError>{error}</FormError>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
            {done ? (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--color-success)]">
                <Check size={15} /> Password updated
              </span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
