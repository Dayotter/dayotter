import { eventConstraints, troubleshootHostDay } from "@/lib/booking/availability";
import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Host-only diagnostic: why does a given event type offer (or not offer) slots on
 * a given day? Returns the schedule windows, booking-window/notice status, and a
 * per-day count of what's blocked by busy time vs notice, with plain-English
 * reasons. See lib/booking/availability#troubleshootHostDay.
 *
 * Individual event types diagnose the owner (pinned to the event type's schedule).
 * Team event types (collective / round-robin) diagnose each host on their default
 * schedule; pass `hostId` to narrow to one. Authorized via team membership.
 */
export const GET = withUser(async (u, request) => {
  const url = new URL(request.url);
  const eventTypeId = url.searchParams.get("eventTypeId");
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD
  const hostIdParam = url.searchParams.get("hostId");
  if (!eventTypeId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return jsonError("eventTypeId and a YYYY-MM-DD date are required", 400);
  }
  // eventTypeId is a uuid column - reject a malformed value up front rather than
  // letting Postgres throw an uncaught "invalid input syntax for type uuid" 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventTypeId)) {
    return jsonError("Event type not found", 404);
  }
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return jsonError("Invalid date", 400);

  const db = getDb();
  const et = await db.query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, eventTypeId),
  });
  if (!et) return jsonError("Event type not found", 404);

  // Resolve which host(s) to diagnose + authorize.
  // - individual (ownerId set): the owner, on the event type's pinned schedule.
  // - team (ownerId null, teamId set): the event type's hosts, each on their own
  //   default schedule; any member of the team may run it. `hostId` narrows to one.
  type Target = { userId: string; scheduleId: string | null; name: string };
  let targets: Target[];

  if (et.ownerId) {
    if (et.ownerId !== u.id) return jsonError("Event type not found", 404);
    targets = [{ userId: u.id, scheduleId: et.scheduleId, name: "you" }];
  } else if (et.teamId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(schema.teamMembers.teamId, et.teamId), eq(schema.teamMembers.userId, u.id)),
    });
    if (!membership) return jsonError("Event type not found", 404);

    const hosts = await db.query.eventTypeHosts.findMany({
      where: eq(schema.eventTypeHosts.eventTypeId, et.id),
      with: { user: true },
    });
    if (hosts.length === 0) return jsonError("This event type has no hosts configured.", 400);

    const selected = hostIdParam ? hosts.filter((h) => h.userId === hostIdParam) : hosts;
    if (selected.length === 0) return jsonError("That host isn't on this event type", 404);
    targets = selected.map((h) => ({
      userId: h.userId,
      scheduleId: null, // team hosts use their own default schedule
      name: h.user?.name || h.user?.email || h.userId,
    }));
  } else {
    return jsonError("Event type not found", 404);
  }

  const constraints = eventConstraints(et);
  const gap = et.minimumGapMinutes ?? 0;
  const diagnoses = await Promise.all(
    targets.map(async (t) => ({
      hostId: t.userId,
      hostName: t.name,
      diagnosis: await troubleshootHostDay(t.userId, t.scheduleId, constraints, date, gap),
    })),
  );

  // Single-host (individual, or a narrowed team host): keep the original
  // `{ diagnosis }` shape so existing web/mobile clients are unaffected.
  if (targets.length === 1) {
    const only = diagnoses[0]!;
    if (!only.diagnosis) return jsonError("No availability schedule is configured.", 400);
    return NextResponse.json({ diagnosis: only.diagnosis, diagnoses });
  }
  return NextResponse.json({ diagnoses });
});
