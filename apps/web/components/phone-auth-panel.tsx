"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Operator enables this alongside Twilio (sends the SMS code) on the server. */
const enabled = process.env.NEXT_PUBLIC_PHONE_AUTH === "1";

/**
 * Passwordless phone sign-in: enter a number, receive an SMS code, verify.
 * Verifying an unknown number auto-provisions an account (server-side
 * `signUpOnVerification`). Renders nothing unless the operator enabled it.
 */
export function PhoneAuthPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: phone.trim() });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Couldn't send a code to that number. Check it and try again.");
      return;
    }
    track("Phone OTP Sent");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.phoneNumber.verify({
      phoneNumber: phone.trim(),
      code: code.trim(),
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "That code didn't match. Request a new one and try again.");
      return;
    }
    track("Signed In", { method: "phone" });
    router.push("/dashboard");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="6"
            y="2"
            width="12"
            height="20"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <line
            x1="10"
            y1="18"
            x2="14"
            y2="18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Continue with phone
      </button>
    );
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      {step === "phone" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14155551234"
            />
            <p className="mt-1.5 text-xs text-[var(--color-faint)]">
              Include your country code. We'll text you a one-time code.
            </p>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending code…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <div>
            <Label htmlFor="otp">Enter the code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
            <p className="mt-1.5 text-xs text-[var(--color-faint)]">
              Sent to {phone}.{" "}
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                className="text-[var(--color-accent)] hover:underline"
              >
                Change number
              </button>
            </p>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Verify & sign in"}
          </Button>
        </form>
      )}
      <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-faint)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        or
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
