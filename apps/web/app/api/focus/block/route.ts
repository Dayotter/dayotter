import { writeBookingToCalendar } from "@/lib/calendar/host-calendar";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  startISO: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  title: z.string().min(1).max(120).default("Deep work"),
});

/** Protect a suggested block by writing a focus event to the user's calendar. */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid block", 400);
  const d = parsed.data;

  const start = new Date(d.startISO);
  const endsAt = new Date(start.getTime() + d.durationMinutes * 60_000);

  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });

  try {
    const written = await writeBookingToCalendar(u.id, {
      title: d.title,
      start,
      end: endsAt,
      timezone: user?.timezone ?? "UTC",
      attendees: [],
    });
    if (!written) {
      return jsonError("Connect a calendar first so blocks have somewhere to land.", 409);
    }
    logger.info("focus block protected", { event: "focus_block_created", userId: u.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("focus block failed", { event: "focus_block_failed", userId: u.id, err });
    return jsonError("Couldn't protect that block. Please try again.", 502);
  }
});
