"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth/auth-client";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const phoneAuthEnabled = process.env.NEXT_PUBLIC_PHONE_AUTH === "1";

/**
 * "Ask Otter by text" - register/verify the phone number that inbound WhatsApp/
 * SMS messages are matched to (users.phone_number). Verifying uses the same OTP
 * flow as phone sign-in; on an active session it attaches the number to this
 * account.
 */
export function OtterTextPanel({
  phoneNumber,
  verified,
  otterNumber,
}: {
  phoneNumber: string | null;
  verified: boolean;
  otterNumber: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "phone" | "code">("idle");
  const [phone, setPhone] = useState(phoneNumber ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const registered = Boolean(phoneNumber) && verified;

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
    setStep("idle");
    setCode("");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardBody className="p-6">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold">Ask Otter by text</h2>
        </div>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Text Otter to book, reschedule, or check your day over WhatsApp and SMS - confirm-first,
          just like in the app.
        </p>

        {registered ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm">
            <p>
              <span className="font-medium text-[var(--color-accent)]">✓ Registered.</span>{" "}
              <span className="text-[var(--color-muted)]">{phoneNumber}</span>
            </p>
            {otterNumber ? (
              <p className="mt-1 text-[var(--color-muted)]">
                Text Otter at{" "}
                <span className="font-medium text-[var(--color-text)]">{otterNumber}</span>.
              </p>
            ) : (
              <p className="mt-1 text-[var(--color-faint)]">
                Your host needs to set the Otter texting number to finish setup.
              </p>
            )}
          </div>
        ) : !phoneAuthEnabled ? (
          <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm text-[var(--color-muted)]">
            Texting Otter needs phone support enabled on this server (Twilio). Ask your admin to
            turn it on.
          </p>
        ) : step === "idle" ? (
          <Button type="button" className="mt-4" onClick={() => setStep("phone")}>
            {phoneNumber ? "Verify your number" : "Register a number"}
          </Button>
        ) : step === "phone" ? (
          <form onSubmit={sendCode} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="otter-phone">Phone number</Label>
              <Input
                id="otter-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+14155551234"
              />
              <p className="mt-1.5 text-xs text-[var(--color-faint)]">
                Include your country code. We'll text you a one-time code.
              </p>
            </div>
            <FormError>{error}</FormError>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending code…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="otter-otp">Enter the code</Label>
              <Input
                id="otter-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
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
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying…" : "Verify"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
