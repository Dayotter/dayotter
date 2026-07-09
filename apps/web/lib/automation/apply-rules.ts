import { logger } from "@calsync/core";
import { and, eq, getDb, schema } from "@calsync/db";

interface BookingContext {
  hostId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Automation Engine: run the host's enabled rules against a just-created booking.
 * Best-effort — never blocks or fails the booking. Actions compose the Planning
 * Engine by inserting time_blocks (prep before / buffer after).
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

    const title = ctx.title.toLowerCase();
    const blocks = rules
      .filter((r) => !r.matchTitle || title.includes(r.matchTitle.toLowerCase()))
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
        };
      });

    if (blocks.length > 0) {
      await db.insert(schema.timeBlocks).values(blocks);
      logger.info("automation rules applied", {
        event: "automation_applied",
        hostId: ctx.hostId,
        created: blocks.length,
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
