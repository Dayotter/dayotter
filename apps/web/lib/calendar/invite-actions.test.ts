import { describe, expect, it } from "vitest";
import { composeDelegateEmail, composeProposalEmail } from "./invite-actions";

describe("composeProposalEmail", () => {
  it("includes both times and the note, and subjects the meeting", () => {
    const e = composeProposalEmail({
      fromName: "Ada",
      title: "Design sync",
      originalISO: "2026-07-15T14:00:00Z",
      proposedISO: "2026-07-16T10:00:00Z",
      message: "mornings work better",
    });
    expect(e.subject).toBe("Proposed new time: Design sync");
    expect(e.text).toContain("Ada proposed a new time");
    expect(e.text).toContain("mornings work better");
    expect(e.html).toContain("Jul 16");
  });

  it("escapes HTML in user-supplied fields", () => {
    const e = composeProposalEmail({
      fromName: "<script>x</script>",
      title: "A & B",
      originalISO: "2026-07-15T14:00:00Z",
      proposedISO: "2026-07-16T10:00:00Z",
    });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&amp; B");
  });
});

describe("composeDelegateEmail", () => {
  it("includes the meeting details and join link", () => {
    const e = composeDelegateEmail({
      fromName: "Ada",
      title: "Board call",
      startISO: "2026-07-15T14:00:00Z",
      organizerName: "Grace",
      meetingUrl: "https://meet.example/abc",
    });
    expect(e.subject).toContain("Board call");
    expect(e.text).toContain("Grace");
    expect(e.text).toContain("https://meet.example/abc");
    expect(e.html).toContain('href="https://meet.example/abc"');
  });

  it("omits optional lines that are absent", () => {
    const e = composeDelegateEmail({
      fromName: "Ada",
      title: "Quick chat",
      startISO: "2026-07-15T14:00:00Z",
    });
    expect(e.text).not.toContain("Where:");
    expect(e.text).not.toContain("Join:");
  });
});
