import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@calsync/core";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ noShow: z.boolean().default(true) });

/** Host marks a booking as a no-show (or reverts it to confirmed). Host-only. */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  const noShow = parsed.success ? parsed.data.noShow : true;

  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    columns: { id: true, hostId: true, status: true },
  });
  if (!booking) return jsonError("Booking not found", 404);
  if (booking.hostId !== u.id) return jsonError("Not your booking", 403);
  if (booking.status === "cancelled") return jsonError("Booking was cancelled", 409);

  await getDb()
    .update(schema.bookings)
    .set({ status: noShow ? "no_show" : "confirmed" })
    .where(and(eq(schema.bookings.id, booking.id)));

  logger.info("booking no-show updated", {
    event: "booking_no_show",
    bookingId: booking.id,
    noShow,
  });
  return NextResponse.json({ ok: true });
});
