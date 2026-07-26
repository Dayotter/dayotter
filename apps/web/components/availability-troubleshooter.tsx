"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DayDiagnosis } from "@dayotter/core";
import { AlertTriangle, CheckCircle2, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";

interface EventTypeLite {
  id: string;
  title: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityTroubleshooter() {
  const [eventTypes, setEventTypes] = useState<EventTypeLite[]>([]);
  const [eventTypeId, setEventTypeId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DayDiagnosis | null>(null);

  useEffect(() => {
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((d: { eventTypes?: EventTypeLite[] }) => {
        const list = d.eventTypes ?? [];
        setEventTypes(list);
        if (list[0]) setEventTypeId(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function run() {
    if (!eventTypeId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/availability/troubleshoot?eventTypeId=${eventTypeId}&date=${date}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Couldn't run the check.");
        return;
      }
      setResult(data.diagnosis as DayDiagnosis);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Stethoscope size={16} /> Availability troubleshooter
          </span>
        }
        description="See exactly why a booking type does (or doesn't) offer times on a given day."
      />
      <CardBody>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="ts-et">Booking type</Label>
            <Select id="ts-et" value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)}>
              {eventTypes.length === 0 ? <option value="">No booking types</option> : null}
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ts-date">Day</Label>
            <Input
              id="ts-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button onClick={run} disabled={loading || !eventTypeId}>
            {loading ? "Checking…" : "Diagnose"}
          </Button>
        </div>

        {error ? (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-[var(--color-danger)]">
            <AlertTriangle size={14} /> {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm">
            <p className="font-medium">
              {result.weekday}, {result.date} —{" "}
              {result.bookableSlots > 0 ? (
                <span className="text-[var(--color-success)]">
                  {result.bookableSlots} slot{result.bookableSlots === 1 ? "" : "s"} bookable
                </span>
              ) : (
                <span className="text-[var(--color-danger)]">no bookable slots</span>
              )}
            </p>

            <ul className="space-y-1.5">
              {result.reasons.map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-[var(--color-muted)]">
                  {result.bookableSlots > 0 ? (
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--color-success)]"
                    />
                  ) : (
                    <AlertTriangle
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--color-amber)]"
                    />
                  )}
                  {r}
                </li>
              ))}
            </ul>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)] sm:grid-cols-4">
              <div>
                <dt>Working hours</dt>
                <dd className="text-[var(--color-text)]">
                  {result.scheduleWindows.length
                    ? result.scheduleWindows.map((w) => `${w.start}–${w.end}`).join(", ")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Schedule capacity</dt>
                <dd className="text-[var(--color-text)]">{result.totalSlots} slots</dd>
              </div>
              <div>
                <dt>Blocked by busy</dt>
                <dd className="text-[var(--color-text)]">{result.blockedByBusy}</dd>
              </div>
              <div>
                <dt>Notice / booking window</dt>
                <dd className="text-[var(--color-text)]">{result.blockedByNoticeOrRange}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
