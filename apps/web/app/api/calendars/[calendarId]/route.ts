import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, inArray, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isHidden: z.boolean().optional(),
  checkForConflicts: z.boolean().optional(),
  isTargetForBookings: z.boolean().optional(),
});

/** Load a calendar and verify it belongs to the signed-in user. */
async function ownedCalendar(userId: string, calendarId: string) {
  const cal = await getDb().query.calendars.findFirst({
    where: eq(schema.calendars.id, calendarId),
    with: { connection: { columns: { userId: true } } },
  });
  if (!cal || cal.connection.userId !== userId) return null;
  return cal;
}

/**
 * Manage a single calendar: rename, toggle whether it blocks availability
 * (checkForConflicts), hide it from lists, or make it the booking write target.
 * A read-only source (ICS feed) can never be a booking target, and there is a
 * single global booking target — setting one clears the rest.
 */
export const PATCH = withUser(
  async (user, request, ctx: { params: Promise<{ calendarId: string }> }) => {
    const { calendarId } = await ctx.params;
    const cal = await ownedCalendar(user.id, calendarId);
    if (!cal) return jsonError("Calendar not found", 404);

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid update", 400);
    const patch = parsed.data;

    if (patch.isTargetForBookings === true && cal.isReadOnly) {
      return jsonError("A read-only calendar can't receive bookings.", 400);
    }

    const db = getDb();

    // Single global booking target: clear it on all of this user's calendars first.
    if (patch.isTargetForBookings === true) {
      const conns = await db.query.calendarConnections.findMany({
        where: eq(schema.calendarConnections.userId, user.id),
        columns: { id: true },
      });
      const connIds = conns.map((c) => c.id);
      if (connIds.length > 0) {
        await db
          .update(schema.calendars)
          .set({ isTargetForBookings: false })
          .where(inArray(schema.calendars.connectionId, connIds));
      }
    }

    await db
      .update(schema.calendars)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.isHidden !== undefined ? { isHidden: patch.isHidden } : {}),
        ...(patch.checkForConflicts !== undefined
          ? { checkForConflicts: patch.checkForConflicts }
          : {}),
        ...(patch.isTargetForBookings !== undefined
          ? { isTargetForBookings: patch.isTargetForBookings }
          : {}),
      })
      .where(eq(schema.calendars.id, calendarId));

    return NextResponse.json({ ok: true });
  },
);
