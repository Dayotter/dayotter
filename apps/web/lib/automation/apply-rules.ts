import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { scheduleBookingFollowUp } from "../booking/reminders";

interface BookingContext {
  bookingId: string;
  hostId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Insert the host's prep/buffer time_blocks for a booking (tagged with the
 * booking id so they can be removed on cancel / re-created on reschedule).
 * Split out so reschedule can re-materialize blocks at the new time without
 * re-firing follow-up emails. Best-effort.
 */
export async function reserveRuleBlocks(ctx: BookingContext): Promise<number> {
  const db = getDb();
  const rules = await db.query.automationRules.findMany({
    where: and(
      eq(schema.automationRules.userId, ctx.hostId),
      eq(schema.automationRules.enabled, true),
    ),
  });
  if (rules.length === 0) return 0;

  const title = ctx.title.toLowerCase();
  const matched = rules.filter((r) => !r.matchTitle || title.includes(r.matchTitle.toLowerCase()));

  const blocks = matched
    .filter((r) => r.action === "prep_block" || r.action === "buffer_after")
    .map((r) => {
      const mins = r.offsetMinutes * 60_000;
      const [start, end] =
        r.action === "buffer_after"
          ? [ctx.endsAt, new Date(ctx.endsAt.getTime() + mins)]
          : [new Date(ctx.startsAt.getTime() - mins), ctx.startsAt];
      return {
        userId: ctx.hostId,
        title: r.blockTitle || (r.action === "buffer_after" ? "Buffer" : "Prep"),
        kind: "focus",
        startsAt: start,
        endsAt: end,
        bookingId: ctx.bookingId,
      };
    });
  if (blocks.length > 0) await db.insert(schema.timeBlocks).values(blocks);
  return blocks.length;
}

/**
 * Automation Engine: run the host's enabled rules against a just-created booking.
 * Best-effort — never blocks or fails the booking. Prep/buffer rules reserve
 * time_blocks; follow-up rules schedule a post-meeting email.
 */
export async function applyBookingRules(ctx: BookingContext): Promise<void> {
  try {
    const db = getDb();
    const rules = await db.query.automationRules.findMany({
      where: and(
        eq(schema.automationRules.userId, ctx.hostId),
        eq(schema.automationRules.enabled, true),
      ),
    });
    if (rules.length === 0) return;

    const blocks = await reserveRuleBlocks(ctx);

    // Follow-up rules schedule a post-meeting email via the reminder infra.
    const title = ctx.title.toLowerCase();
    const followups = rules.filter(
      (r) =>
        r.action === "followup" && (!r.matchTitle || title.includes(r.matchTitle.toLowerCase())),
    );
    for (const r of followups) {
      await scheduleBookingFollowUp(ctx.bookingId, ctx.endsAt, r.offsetMinutes);
    }

    if (blocks + followups.length > 0) {
      logger.info("automation rules applied", {
        event: "automation_applied",
        hostId: ctx.hostId,
        blocks,
        followups: followups.length,
      });
    }
  } catch (err) {
    logger.error("automation rules failed", {
      event: "automation_failed",
      hostId: ctx.hostId,
      err,
    });
  }
}
