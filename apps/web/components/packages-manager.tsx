"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";

interface EventTypeOpt {
  id: string;
  title: string;
}
interface PackageRow {
  id: string;
  eventTypeId: string;
  name: string;
  sessionCount: number;
  priceAmount: number;
  currency: string;
  isActive: boolean;
}
interface CreditRow {
  id: string;
  eventTypeId: string;
  clientEmail: string;
  total: number;
  used: number;
  remaining: number;
}

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);
}

/**
 * Host-facing management for prepaid session packages: create offerings tied to
 * an event type, see outstanding client balances, and grant credits manually
 * (for clients who paid offline).
 */
export function PackagesManager({ eventTypes }: { eventTypes: EventTypeOpt[] }) {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-offering form.
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState(5);
  const [price, setPrice] = useState(250);
  const [saving, setSaving] = useState(false);

  // Grant form (per package).
  const [grantEmail, setGrantEmail] = useState<Record<string, string>>({});

  const titleFor = useCallback(
    (id: string) => eventTypes.find((e) => e.id === id)?.title ?? "Unknown event type",
    [eventTypes],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/packages", { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load packages");
      const data = (await res.json()) as { packages: PackageRow[]; credits: CreditRow[] };
      setPackages(data.packages);
      setCredits(data.credits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTypeId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventTypeId,
          name: name.trim(),
          sessionCount: sessions,
          priceAmount: Math.round(price * 100),
          currency: "usd",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : "Couldn't create package");
      }
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function grant(packageId: string) {
    const email = (grantEmail[packageId] ?? "").trim();
    if (!email) return;
    setError(null);
    try {
      const res = await fetch("/api/packages/grant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId, clientEmail: email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.error === "string" ? d.error : "Couldn't grant credits");
      }
      setGrantEmail((m) => ({ ...m, [packageId]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (eventTypes.length === 0) {
    return (
      <Card className="max-w-2xl">
        <CardBody className="p-6 text-sm text-[var(--color-muted)]">
          Create a booking type first - packages are sold against one of your event types.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {error ? <FormError>{error}</FormError> : null}

      {/* Create an offering */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold">New package</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Sell a bundle of sessions for one of your booking types. Clients spend a credit each
            time they book it.
          </p>
          <form onSubmit={createPackage} className="mt-5 flex flex-col gap-4">
            <div>
              <Label htmlFor="pkg-et">Booking type</Label>
              <Select
                id="pkg-et"
                value={eventTypeId}
                onChange={(e) => setEventTypeId(e.target.value)}
              >
                {eventTypes.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pkg-name">Name</Label>
              <Input
                id="pkg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Coaching 5-pack"
                required
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="pkg-sessions">Sessions</Label>
                <Input
                  id="pkg-sessions"
                  type="number"
                  min={1}
                  max={100}
                  value={sessions}
                  onChange={(e) => setSessions(Number(e.target.value))}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="pkg-price">Price (USD)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </div>
            </div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create package"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Offerings + grant */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold">Your packages</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Loading…</p>
          ) : packages.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">No packages yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {packages.map((p) => (
                <li
                  key={p.id}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-[var(--color-muted)]">
                      {p.sessionCount} sessions · {money(p.priceAmount, p.currency)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-faint)]">
                    {titleFor(p.eventTypeId)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      type="email"
                      placeholder="Grant to client email…"
                      value={grantEmail[p.id] ?? ""}
                      onChange={(e) => setGrantEmail((m) => ({ ...m, [p.id]: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => grant(p.id)}
                      disabled={!(grantEmail[p.id] ?? "").trim()}
                    >
                      Grant
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Client balances */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold">Client balances</h2>
          {credits.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              No credits issued yet. Grant a package above, or share a package purchase link.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-border)]">
              {credits.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-medium">{c.clientEmail}</span>
                    <span className="block text-xs text-[var(--color-faint)]">
                      {titleFor(c.eventTypeId)}
                    </span>
                  </span>
                  <span className={c.remaining === 0 ? "text-[var(--color-faint)]" : ""}>
                    {c.used} of {c.total} used
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
