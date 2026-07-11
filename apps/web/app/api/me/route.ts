import { aiEnabled } from "@/lib/ai/llm";
import { getEntitlements } from "@/lib/billing/entitlements";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Current user + profile + server capabilities + plan entitlements + setup progress. */
export const GET = withUser(async (u) => {
  const db = getDb();
  const [user, prefs, entitlements, conns, defaultSchedule, activeEvents] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, u.id),
      columns: { id: true, name: true, email: true, image: true, handle: true, timezone: true },
    }),
    db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, u.id),
      columns: { brandColor: true, welcomeMessage: true },
    }),
    getEntitlements(u.id),
    db.query.calendarConnections.findMany({
      where: eq(schema.calendarConnections.userId, u.id),
      columns: { id: true },
      limit: 1,
    }),
    db.query.schedules.findFirst({
      where: and(eq(schema.schedules.userId, u.id), eq(schema.schedules.isDefault, true)),
      with: { availabilityRules: { columns: { id: true }, limit: 1 } },
    }),
    db.query.eventTypes.findMany({
      where: and(eq(schema.eventTypes.ownerId, u.id), eq(schema.eventTypes.isActive, true)),
      columns: { id: true },
      limit: 1,
    }),
  ]);
  if (!user) return jsonError("Not found", 404);
  const branding = {
    brandColor: prefs?.brandColor ?? null,
    welcomeMessage: prefs?.welcomeMessage ?? null,
  };
  // Setup progress — drives the mobile "get bookable" checklist (mirrors the web dashboard).
  const setup = {
    hasCalendar: conns.length > 0,
    hasHours: (defaultSchedule?.availabilityRules.length ?? 0) > 0,
    hasEventType: activeEvents.length > 0,
  };
  return NextResponse.json({ user, branding, setup, aiEnabled, paymentsEnabled, entitlements });
});
