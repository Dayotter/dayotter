import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";

interface TravelContext {
  hostId: string;
  /** The booking these blocks belong to (so they clean up on cancel/reschedule). */
  bookingId: string;
  /** Event type location type (e.g. "in_person", "google_meet"). */
  location: string;
  startsAt: Date;
  endsAt: Date;
  /** Human place description, used to label the reserved blocks. */
  place?: string | null;
}

/**
 * Travel-Aware Scheduling: for in-person meetings, reserve the host's configured
 * travel time as `travel` time_blocks before and after the booking. The
 * availability engine already treats time_blocks as busy, so this stops the host
 * being offered back-to-back slots that leave no room to physically get there.
 *
 * Composes the Planning Engine (time_blocks) - no maps/geocoding. Best-effort:
 * never blocks or fails the booking.
 */
export async function reserveTravelBlocks(ctx: TravelContext): Promise<void> {
  if (ctx.location !== "in_person") return;
  try {
    const db = getDb();
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, ctx.hostId),
      columns: { travelBufferMinutes: true },
    });
    const mins = prefs?.travelBufferMinutes ?? 0;
    if (mins <= 0) return;

    const ms = mins * 60_000;
    const title = ctx.place ? `Travel - ${ctx.place}` : "Travel";
    await db.insert(schema.timeBlocks).values([
      {
        userId: ctx.hostId,
        title,
        kind: "travel",
        startsAt: new Date(ctx.startsAt.getTime() - ms),
        endsAt: ctx.startsAt,
        bookingId: ctx.bookingId,
      },
      {
        userId: ctx.hostId,
        title,
        kind: "travel",
        startsAt: ctx.endsAt,
        endsAt: new Date(ctx.endsAt.getTime() + ms),
        bookingId: ctx.bookingId,
      },
    ]);
    logger.info("travel blocks reserved", {
      event: "travel_reserved",
      hostId: ctx.hostId,
      minutes: mins,
    });
  } catch (err) {
    logger.error("travel reserve failed", {
      event: "travel_failed",
      hostId: ctx.hostId,
      err,
    });
  }
}
