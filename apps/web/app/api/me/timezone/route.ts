import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ timezone: z.string().min(1).max(64) });

/** True for a real IANA zone (e.g. "Asia/Kolkata"). */
function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Auto-set the caller's timezone from their browser - but ONLY when it's still
 * the unconfigured default ("UTC"/null). Once a user (or a real detection) has
 * set a concrete zone, we never silently override it. This is what stops an
 * India user from seeing UTC times in suggestions when they never opened the
 * profile form.
 */
export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid timezone", 400);
  const tz = parsed.data.timezone;
  if (tz === "UTC" || !isValidZone(tz)) return NextResponse.json({ updated: false });

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });
  // Only fill in an unconfigured zone; respect an explicit choice.
  if (user?.timezone && user.timezone !== "UTC") return NextResponse.json({ updated: false });

  await db.update(schema.users).set({ timezone: tz }).where(eq(schema.users.id, u.id));
  return NextResponse.json({ updated: true });
});
