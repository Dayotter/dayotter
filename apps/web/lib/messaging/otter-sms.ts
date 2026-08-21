import { interpretOtterCommand } from "@/lib/ai/interpret";
import { cancelBooking } from "@/lib/booking/cancel-booking";
import { LOCATION_TYPES, type LocationTypeValue } from "@/lib/booking/event-type-input";
import { createOtterEvent } from "@/lib/booking/otter-create";
import { rescheduleBooking } from "@/lib/booking/reschedule-booking";
import type { RecurrenceFreq } from "@/lib/calendar/recurrence";
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
      /** "focus" is held as a personal focus block, not a meeting. */
      kind?: "meeting" | "focus" | "reminder";
      /** Ad-hoc meeting location, when the request named one and there's no event type. */
      location?: LocationTypeValue;
      locationDetail?: string;
      /** Recurrence: the whole series is expanded on confirm. */
      recurrenceFreq?: RecurrenceFreq;
      recurrenceDays?: number[];
      recurrenceCount?: number;
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
  const { draft, timezone: tz, target, answer } = await interpretOtterCommand(userId, text);

  // A question / out-of-scope ask → text the answer straight back, nothing to confirm.
  if (answer) return { reply: answer };

  if (!draft.understood || draft.intent === "none") {
    return {
      reply:
        draft.message ||
        'I help with scheduling - try things like "book a 30-min call with Sam Thursday 2pm" or "move my 3pm to tomorrow".',
    };
  }

  if (draft.intent === "create") {
    const when = whenLabel(draft.startISO, tz);
    // Keep only a valid location type (the draft field is a lenient string).
    const location = LOCATION_TYPES.includes(draft.location as LocationTypeValue)
      ? (draft.location as LocationTypeValue)
      : undefined;
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
        kind: draft.kind,
        location,
        locationDetail: draft.locationDetail || undefined,
        recurrenceFreq: draft.recurrenceFreq,
        recurrenceDays: draft.recurrenceDays,
        recurrenceCount: draft.recurrenceCount,
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
      const attendees = pending.attendees
        .filter((a) => a.email.includes("@"))
        .map((a) => ({ email: a.email, name: a.name || undefined }));
      const result = await createOtterEvent({
        userId,
        title: pending.title,
        start: new Date(pending.startISO),
        durationMinutes: pending.durationMinutes,
        timezone: pending.timezone,
        notes: pending.notes || undefined,
        attendees,
        eventTypeSlug: pending.eventTypeSlug,
        location: pending.location,
        locationDetail: pending.locationDetail,
        kind: pending.kind,
        recurrenceFreq: pending.recurrenceFreq,
        recurrenceDays: pending.recurrenceDays,
        recurrenceCount: pending.recurrenceCount,
      });
      if (result.count === 0) {
        return "I couldn't add that right now - please try again, or use the app.";
      }
      const when = whenLabel(pending.startISO, pending.timezone);
      const times = result.count > 1 ? ` (${result.count}×, starting ${when})` : ` for ${when}`;
      if (pending.kind === "focus" || pending.kind === "reminder") {
        const label = pending.kind === "reminder" ? "Reminder" : "Focus time";
        return `Done ✓ ${label} "${pending.title}" is held${times}.`;
      }
      return `Done ✓ "${pending.title}" is on your calendar${times}.`;
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
