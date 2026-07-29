import { describe, expect, it } from "vitest";
import { mergeAgenda } from "./agenda";

const d = (iso: string) => new Date(iso);

describe("mergeAgenda", () => {
  it("interleaves bookings and external events in chronological order", () => {
    const items = mergeAgenda(
      [
        {
          title: "Intro call",
          startsAt: d("2026-07-30T15:00:00Z"),
          endsAt: d("2026-07-30T15:30:00Z"),
          uid: "b1",
          attendees: ["Dana"],
        },
        {
          title: "Standup",
          startsAt: d("2026-07-30T09:00:00Z"),
          endsAt: d("2026-07-30T09:15:00Z"),
          uid: "b2",
          attendees: [],
        },
      ],
      [
        {
          title: "Dentist",
          startsAt: d("2026-07-30T11:00:00Z"),
          endsAt: d("2026-07-30T12:00:00Z"),
        },
      ],
      50,
    );

    expect(items.map((i) => i.title)).toEqual(["Standup", "Dentist", "Intro call"]);
  });

  it("tags each item with its source and preserves the booking uid", () => {
    const items = mergeAgenda(
      [
        {
          title: "Intro call",
          startsAt: d("2026-07-30T15:00:00Z"),
          endsAt: d("2026-07-30T15:30:00Z"),
          uid: "b1",
          attendees: ["Dana"],
        },
      ],
      [{ title: "Busy", startsAt: d("2026-07-30T16:00:00Z"), endsAt: d("2026-07-30T17:00:00Z") }],
      50,
    );

    const booking = items.find((i) => i.title === "Intro call")!;
    const external = items.find((i) => i.title === "Busy")!;
    expect(booking.source).toBe("booking");
    expect(booking.uid).toBe("b1");
    expect(booking.attendees).toEqual(["Dana"]);
    expect(external.source).toBe("external");
    expect(external.uid).toBeUndefined();
    expect(external.attendees).toEqual([]);
  });

  it("caps the merged list at the limit, keeping the earliest items", () => {
    const bookings = Array.from({ length: 5 }, (_, i) => ({
      title: `B${i}`,
      startsAt: d(`2026-07-30T${String(10 + i).padStart(2, "0")}:00:00Z`),
      endsAt: d(`2026-07-30T${String(10 + i).padStart(2, "0")}:30:00Z`),
      uid: `b${i}`,
      attendees: [],
    }));
    const items = mergeAgenda(bookings, [], 3);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.title)).toEqual(["B0", "B1", "B2"]);
  });
});
