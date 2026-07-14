import { interpretOtterCommand } from "@/lib/ai/interpret";
import { cancelBooking } from "@/lib/booking/cancel-booking";
import { createHostBooking } from "@/lib/booking/host-booking";
import { rescheduleBooking } from "@/lib/booking/reschedule-booking";
import { logger } from "@dayotter/core";
import { DateTime } from "luxon";

/**
 * A proposed action, held pending an explicit "YES" reply over SMS/WhatsApp.
 * Carries everything needed to execute without re-running the model, so the
 * confirmation is on exactly what the user was shown.
 */
export type PendingAction =
  | {
      intent: "create";
      title: string;
      startISO: string;
      durationMinutes: number;
      notes: string;
      attendees: { name: string; email: string }[];
      timezone: string;
      eventTypeSlug?: string;
    }
  | { intent: "reschedule"; uid: string; newStartISO: string; title: string; timezone: string }
  | { intent: "cancel"; uid: string; title: string };

export interface InterpretResult {
  /** The message to send back to the user. */
  reply: string;
  /** If set, an action awaiting a "YES" confirmation. */
  pending?: PendingAction;
}

function whenLabel(iso: string, tz: string): string {
  return DateTime.fromISO(iso).setZone(tz).toFormat("ccc, LLL d 'at' h:mm a");
}

/**
 * Interpret an inbound message with Otter and return a reply. Uses the same
 * interpret core as the web/mobile command bar, so texting Otter behaves
 * identically. For an actionable request it returns a `pending` action and a
 * "reply YES to confirm" prompt - confirm-first, over text.
 */
export async function interpretForSms(userId: string, text: string): Promise<InterpretResult> {
  const { draft, timezone: tz, target } = await interpretOtterCommand(userId, text);

  if (!draft.understood || draft.intent === "none") {
    return {
      reply:
        draft.message ||
        'I help with scheduling - try things like "book a 30-min call with Sam Thursday 2pm" or "move my 3pm to tomorrow".',
    };
  }

  if (draft.intent === "create") {
    const when = whenLabel(draft.startISO, tz);
    return {
      reply: `I'll add "${draft.title}" on ${when} (${draft.durationMinutes} min). Reply YES to confirm, or NO to cancel.`,
      pending: {
        intent: "create",
        title: draft.title,
        startISO: draft.startISO,
        durationMinutes: draft.durationMinutes,
        notes: draft.notes,
        attendees: draft.attendees,
        timezone: tz,
        eventTypeSlug: draft.eventTypeSlug || undefined,
      },
    };
  }

  if (!target) {
    return { reply: "I couldn't tell which meeting you meant - try naming it or its time." };
  }

  if (draft.intent === "reschedule") {
    const when = whenLabel(draft.newStartISO, tz);
    return {
      reply: `I'll move "${target.title}" to ${when}. Reply YES to confirm, or NO to cancel.`,
      pending: {
        intent: "reschedule",
        uid: target.uid,
        newStartISO: draft.newStartISO,
        title: target.title,
        timezone: tz,
      },
    };
  }

  // cancel
  return {
    reply: `I'll cancel "${target.title}". Reply YES to confirm, or NO to cancel.`,
    pending: { intent: "cancel", uid: target.uid, title: target.title },
  };
}

/** Execute a previously-confirmed pending action. Returns the reply to send. */
export async function executePending(userId: string, pending: PendingAction): Promise<string> {
  try {
    if (pending.intent === "create") {
      const start = new Date(pending.startISO);
      const end = new Date(start.getTime() + pending.durationMinutes * 60_000);
      const attendees = pending.attendees
        .filter((a) => a.email.includes("@"))
        .map((a) => ({ email: a.email, name: a.name || undefined }));
      const result = await createHostBooking({
        userId,
        title: pending.title,
        start,
        end,
        timezone: pending.timezone,
        notes: pending.notes || undefined,
        attendees,
        eventTypeSlug: pending.eventTypeSlug,
      });
      if (!result) return "I couldn't add that right now - please try again, or use the app.";
      return `Done ✓ "${pending.title}" is on your calendar for ${whenLabel(pending.startISO, pending.timezone)}.`;
    }

    if (pending.intent === "reschedule") {
      await rescheduleBooking(pending.uid, pending.newStartISO);
      return `Done ✓ "${pending.title}" moved to ${whenLabel(pending.newStartISO, pending.timezone)}.`;
    }

    const ok = await cancelBooking(pending.uid, "Cancelled via Otter");
    return ok
      ? `Done ✓ "${pending.title}" is cancelled.`
      : "That meeting couldn't be cancelled - it may already be gone.";
  } catch (err) {
    logger.error("otter sms execute failed", { event: "otter_sms_execute_failed", userId, err });
    return "Something went wrong carrying that out. Please try again, or use the app.";
  }
}
