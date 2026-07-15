"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { Banknote, CheckCircle2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);
}

interface CurrencyBalance {
  currency: string;
  available: number;
  pending: number;
}

export function PayoutsPanel({
  connected,
  chargesEnabled,
  payoutsEnabled,
  detailsSubmitted,
  balances,
  minimum,
  feePercent,
}: {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  balances: CurrencyBalance[];
  minimum: number;
  feePercent: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const ready = connected && chargesEnabled && payoutsEnabled;
  // Withdraw is enabled if ANY currency bucket clears the minimum.
  const canWithdraw = ready && balances.some((b) => b.available >= minimum);
  // A stable primary currency for framing the minimum copy.
  const primary = balances[0]?.currency ?? "usd";

  async function withdraw() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/payments/withdraw", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Withdrawal failed.");
      return;
    }
    track("Payout Requested");
    const paid: { amount: number; currency: string }[] = Array.isArray(data.payouts)
      ? data.payouts
      : [];
    const sent = paid.map((p) => money(p.amount ?? 0, p.currency)).join(" + ");
    setDone(`${sent || "Your balance"} is on its way to your bank.`);
    router.refresh();
  }

  // Not connected, or onboarding not finished → send them to Stripe.
  if (!ready) {
    const started = connected && detailsSubmitted;
    return (
      <Card className="max-w-2xl">
        <CardHeader
          title="Get paid directly"
          description="Connect a Stripe account so booking and package payments land in your bank - not ours."
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-[var(--color-muted)]">
            {started
              ? "Your payout account still needs a few details before Stripe can enable charges and payouts."
              : "You'll be taken to Stripe to add your bank details. It takes a couple of minutes."}
            {feePercent > 0 ? (
              <> DayOtter keeps a {feePercent}% platform fee on each payment; the rest is yours.</>
            ) : null}
          </p>
          {/* Plain <a>: this 302s to Stripe onboarding (full navigation, like calendar connect). */}
          <a href="/api/payments/connect" className={buttonVariants({ variant: "primary" })}>
            {started ? "Finish payout setup" : "Connect payouts"}
          </a>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--color-success)]" /> Payouts connected
          </span>
        }
        description={
          feePercent > 0
            ? `Payments land in your Stripe account minus DayOtter's ${feePercent}% fee.`
            : "Payments land straight in your Stripe account."
        }
      />
      <CardBody className="space-y-5">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--color-faint)]">
            Available to withdraw
          </p>
          {balances.length === 0 ? (
            <p className="mt-1 font-display text-3xl tabular-nums">{money(0, primary)}</p>
          ) : (
            <div className="mt-1 space-y-1">
              {balances.map((b) => (
                <div key={b.currency} className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-3xl tabular-nums">
                    {money(b.available, b.currency)}
                  </span>
                  {b.pending > 0 ? (
                    <span className="text-xs text-[var(--color-faint)]">
                      {money(b.pending, b.currency)} on the way
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-[var(--color-faint)]">
            Minimum withdrawal {money(minimum, primary)} per currency.
          </p>
        </div>

        {done ? (
          <p className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
            <CheckCircle2 size={15} /> {done}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={withdraw} disabled={!canWithdraw || busy}>
              <Banknote size={16} /> {busy ? "Starting…" : "Withdraw to bank"}
            </Button>
            {!canWithdraw ? (
              <span className="text-sm text-[var(--color-muted)]">
                You can withdraw once your balance reaches {money(minimum, primary)}.
              </span>
            ) : null}
          </div>
        )}
        <FormError>{error}</FormError>

        <a
          href="/api/payments/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit gap-1.5 text-[var(--color-muted)]",
          )}
        >
          Update bank / tax details <ExternalLink size={13} />
        </a>
      </CardBody>
    </Card>
  );
}
