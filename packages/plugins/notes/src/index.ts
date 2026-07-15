import { definePlugin } from "@dayotter/plugin-sdk";

/**
 * Notes - a reference DayOtter plugin. It shows the three things most plugins do:
 *  1. add Otter tools (a confirm-first "save a note" action + a "list notes" read),
 *  2. react to a booking lifecycle event (create a note stub when a meeting is
 *     booked - the seed of a scribe/recap workflow), and
 *  3. persist data through the scoped storage the host provides.
 *
 * Copy this as the starting point for your own plugin.
 */

interface Note {
  text: string;
  subject?: string;
  bookingId?: string;
  at: string;
}

export default definePlugin({
  id: "notes",
  name: "Notes",
  description: "Jot notes on your day and your meetings, by asking Otter.",
  version: "0.1.0",

  tools: [
    {
      name: "save-note",
      description:
        "Save a short note. Use when the user wants to remember something - a takeaway, a to-do, a thought about a meeting.",
      kind: "action",
      title: "Save note",
      danger: false,
      schema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The note text." },
          subject: { type: "string", description: "Optional short label for the note." },
        },
        required: ["text"],
      },
      summarize: (input) =>
        `Save a note${input.subject ? ` about “${String(input.subject)}”` : ""}`,
      async run(ctx, input) {
        const text = String(input.text ?? "").trim();
        if (!text) return "Nothing to save - the note was empty.";
        const note: Note = {
          text,
          subject: input.subject ? String(input.subject) : undefined,
          at: new Date().toISOString(),
        };
        await ctx.storage.set(`note:${note.at}`, note);
        ctx.logger.info("note saved");
        return "Saved your note.";
      },
    },
    {
      name: "list-notes",
      description: "List the user's recent saved notes.",
      kind: "read",
      schema: { type: "object", properties: {} },
      async run(ctx) {
        const rows = await ctx.storage.list<Note>("note:");
        const notes = rows
          .map((r) => r.value)
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .slice(0, 20)
          .map((n) => ({ at: n.at, subject: n.subject, text: n.text }));
        return JSON.stringify({ count: notes.length, notes });
      },
    },
  ],

  bookingHooks: [
    {
      on: ["created"],
      async handle(ctx, _event, booking) {
        // Seed an empty note tied to the meeting, ready to fill in afterwards.
        const note: Note = {
          text: "",
          subject: booking.title,
          bookingId: booking.bookingId,
          at: booking.startsAt,
        };
        await ctx.storage.set(`note:booking:${booking.bookingId}`, note);
        ctx.logger.info("seeded meeting note", { bookingId: booking.bookingId });
      },
    },
  ],
});
