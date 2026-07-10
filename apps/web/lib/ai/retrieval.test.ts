import { describe, expect, it } from "vitest";
import { type RetrievedBooking, selectRelevantBookings } from "./retrieval";

const b = (
  uid: string,
  iso: string,
  title: string,
  attendees: string[] = [],
): RetrievedBooking => ({
  uid,
  title,
  startsAt: new Date(iso),
  endsAt: new Date(new Date(iso).getTime() + 30 * 60_000),
  attendees,
});

// Chronological (as the DB query returns them).
const ALL = [
  b("1", "2026-07-11T09:00:00Z", "Standup"),
  b("2", "2026-07-11T15:00:00Z", "1:1 with Dana", ["Dana Lee"]),
  b("3", "2026-07-12T10:00:00Z", "Design review"),
  b("4", "2026-07-13T11:00:00Z", "Interview", ["Sam Fox"]),
  b("5", "2026-07-14T14:00:00Z", "Budget sync with Priya", ["Priya N"]),
];

describe("selectRelevantBookings", () => {
  it("returns [] for no bookings", () => {
    expect(selectRelevantBookings([], "anything", 12)).toEqual([]);
  });

  it("anchors on the soonest bookings when the query has no keyword match", () => {
    // "my 3pm tomorrow" has no matchable term → soonest-first anchor.
    const out = selectRelevantBookings(ALL, "move my 3pm tomorrow", 3);
    expect(out.map((x) => x.uid)).toEqual(["1", "2", "3"]);
  });

  it("includes a keyword match even when it's far in the future", () => {
    // limit 6 → all fit, but ensure the Priya match is present.
    const out = selectRelevantBookings(ALL, "reschedule the budget sync with Priya", 6);
    expect(out.map((x) => x.uid)).toContain("5");
  });

  it("matches on attendee names", () => {
    const out = selectRelevantBookings(ALL, "cancel the meeting with Dana", 2);
    // Dana (uid 2) must be selected despite the 2-item cap (anchor #1 + match #2).
    expect(out.map((x) => x.uid)).toContain("2");
  });

  it("returns results in chronological order and respects the cap", () => {
    const out = selectRelevantBookings(ALL, "budget interview design", 3);
    expect(out).toHaveLength(3);
    const times = out.map((x) => x.startsAt.getTime());
    expect(times).toEqual([...times].sort((a, z) => a - z));
  });
});
