import { bookingConfirmation, pollInvitation, pollVoteUpdate } from "@dayotter/emails";
import { describe, expect, it } from "vitest";
import {
  applyCalendarMessage,
  applyFinalizeMessage,
  validatePollTemplate,
} from "./message-templates";
import { PollError, normalizeInviteeEmails, resolvePollVoter } from "./polls";

describe("poll participation", () => {
  it("normalizes and deduplicates invitation recipients", () => {
    expect(
      normalizeInviteeEmails([
        " Alex@example.com ",
        "alex@example.com",
        "SAM@example.com",
        "not-an-email",
      ]),
    ).toEqual(["alex@example.com", "sam@example.com"]);
  });

  it("binds an invite-only vote to the email behind its token", () => {
    expect(
      resolvePollVoter(
        "invited",
        [{ email: "alex@example.com", token: "personal-token" }],
        "personal-token",
        { name: " Alex ", email: "spoofed@example.com" },
      ),
    ).toEqual({ name: "Alex", email: "alex@example.com" });
  });

  it("rejects an invite-only vote without a matching personal token", () => {
    expect(() =>
      resolvePollVoter(
        "invited",
        [{ email: "alex@example.com", token: "personal-token" }],
        "wrong-token",
        { name: "Alex", email: "alex@example.com" },
      ),
    ).toThrowError(PollError);
  });

  it("keeps public voting open to a supplied identity", () => {
    expect(
      resolvePollVoter("public", [], undefined, { name: " Sam ", email: "SAM@EXAMPLE.COM" }),
    ).toEqual({ name: "Sam", email: "sam@example.com" });
  });

  it("summarizes poll progress in the organizer notification", () => {
    const email = pollVoteUpdate({
      pollTitle: "Planning",
      voterName: "Alex",
      voterEmail: "alex@example.com",
      participationLabel: "2 of 3 invited recipients have voted",
      resultsUrl: "https://example.com/polls/one",
      timezone: "Africa/Johannesburg",
      options: [
        {
          startsAt: new Date("2026-08-27T08:00:00Z"),
          yes: 2,
          maybe: 1,
          no: 0,
        },
      ],
    });

    expect(email.subject).toBe("New vote: Planning");
    expect(email.text).toContain("Poll status: Open · 2 of 3 invited recipients have voted");
    expect(email.text).toContain("2 yes, 1 maybe, 0 no");
    expect(email.html).toContain("https://example.com/polls/one");
  });

  it("includes the host's note in the invitation email", () => {
    const email = pollInvitation({
      pollTitle: "Planning",
      hostName: "Sam",
      voteUrl: "https://example.com/poll/abc",
      optionCount: 3,
      message: "Bring your laptop.\n\nAgenda attached.",
    });

    expect(email.text).toContain("Bring your laptop.\n\nAgenda attached.");
    expect(email.html).toContain("Bring your laptop.</p><p");
    expect(email.html).toContain("Agenda attached.</p>");
  });

  it("keeps the invitation email unchanged without a note", () => {
    const email = pollInvitation({
      pollTitle: "Planning",
      hostName: "Sam",
      voteUrl: "https://example.com/poll/abc",
      optionCount: 3,
    });

    expect(email.text).toContain("Vote here: https://example.com/poll/abc");
    expect(email.html).not.toContain("<br/>");
  });

  it("sends meeting details with the booking confirmation", () => {
    const email = bookingConfirmation({
      eventTitle: "Planning",
      start: new Date("2026-08-27T08:00:00Z"),
      end: new Date("2026-08-27T08:30:00Z"),
      timezone: "UTC",
      hostName: "Sam",
      attendeeName: "Alex",
      meetingUrl: "https://meet.example.com/abc",
      manageUrl: "https://example.com/poll/abc",
      message: "Join via Zoom:\nhttps://zoom.us/j/123",
    });

    expect(email.text).toContain("Join via Zoom:\nhttps://zoom.us/j/123");
    expect(email.html).toContain("https://zoom.us/j/123");
  });

  it("names who booked and who else is attending", () => {
    const email = bookingConfirmation({
      eventTitle: "Planning",
      start: new Date("2026-08-27T08:00:00Z"),
      end: new Date("2026-08-27T08:30:00Z"),
      timezone: "UTC",
      hostName: "Sam",
      attendeeName: "Alex",
      meetingUrl: "https://meet.example.com/abc",
      manageUrl: "https://example.com/booking/x",
      booker: { name: "Alex", email: "alex@example.com" },
      addedAttendees: [{ email: "sam@example.com" }, { name: "Pat", email: "pat@example.com" }],
    });

    expect(email.text).toContain("Booked by: Alex <alex@example.com>");
    expect(email.text).toContain("Also attending: sam@example.com, Pat <pat@example.com>");
    expect(email.html).toContain("Booked by: Alex &lt;alex@example.com&gt;");
    expect(email.html).toContain("pat@example.com");
  });

  it("omits the booker/attendee lines when no one is named", () => {
    const email = bookingConfirmation({
      eventTitle: "Planning",
      start: new Date("2026-08-27T08:00:00Z"),
      end: new Date("2026-08-27T08:30:00Z"),
      timezone: "UTC",
      hostName: "Sam",
      attendeeName: "Alex",
      meetingUrl: "https://meet.example.com/abc",
      manageUrl: "https://example.com/booking/x",
    });

    expect(email.text).not.toContain("Booked by:");
    expect(email.text).not.toContain("Also attending:");
  });

  it("fills the meeting-details placeholder with the generated link", () => {
    expect(applyFinalizeMessage("Join here: {details}", "https://meet.example.com/abc")).toBe(
      "Join here: https://meet.example.com/abc",
    );
    // No generated link: the host's own text is sent as-is.
    expect(applyFinalizeMessage("Join here: {details}", undefined)).toBe("Join here: {details}");
    expect(applyFinalizeMessage("  ", undefined)).toBeUndefined();
    expect(applyFinalizeMessage(undefined, "https://meet.example.com/abc")).toBeUndefined();
  });

  it("fills the calendar description placeholder with the location label", () => {
    expect(applyCalendarMessage("Join here: {details}", "Zoom")).toBe("Join here: Zoom");
    // A link the host pasted themselves is kept verbatim.
    expect(applyCalendarMessage("Join via Zoom:\nhttps://zoom.us/j/123", "Zoom")).toBe(
      "Join via Zoom:\nhttps://zoom.us/j/123",
    );
    expect(applyCalendarMessage("  ", "Zoom")).toBeUndefined();
  });

  it("validates saved-template names and bodies", () => {
    expect(validatePollTemplate({ name: "Zoom 1:1", body: "Join: {details}" })).toBeNull();
    expect(validatePollTemplate({ name: "  ", body: "Join: {details}" })).toBe(
      "Give the template a name.",
    );
    expect(validatePollTemplate({ name: "Zoom", body: "  " })).toBe(
      "Add the message text for the template.",
    );
    expect(validatePollTemplate({ name: "x".repeat(61), body: "Join" })).toBe(
      "Template names are at most 60 characters.",
    );
  });
});
