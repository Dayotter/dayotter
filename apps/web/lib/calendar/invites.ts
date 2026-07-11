import type { CalendarInvite, InviteResponse } from "@dayotter/calendar";
import { logger } from "@dayotter/core";
import { and, eq, getDb, gte, inArray, lte, schema } from "@dayotter/db";
import { adapterForConnection } from "@dayotter/integrations";

export interface PendingInvite extends CalendarInvite {
  connectionId: string;
  /** True if this invite's time overlaps something you're already busy for. */
  hasConflict: boolean;
}

/**
 * Pending invitations across all of a user's connected calendars, annotated with
 * whether each conflicts with their existing schedule. Read-only.
 */
export async function listPendingInvites(userId: string, days = 30): Promise<PendingInvite[]> {
  const db = getDb();
  const now = new Date();
  const end = new Date(now.getTime() + days * 86_400_000);

  const connections = await db.query.calendarConnections.findMany({
    where: and(
      eq(schema.calendarConnections.userId, userId),
      eq(schema.calendarConnections.status, "active"),
    ),
    with: { calendars: true },
  });

  const collected: { invite: CalendarInvite; connectionId: string }[] = [];
  for (const conn of connections) {
    let adapter: Awaited<ReturnType<typeof adapterForConnection>>;
    try {
      adapter = await adapterForConnection(conn);
    } catch {
      continue;
    }
    if (!adapter.listInvites) continue; // provider has no RSVP concept (CalDAV)
    for (const cal of conn.calendars) {
      if (!cal.checkForConflicts) continue;
      try {
        const invites = await adapter.listInvites(cal.externalId, now, end);
        for (const inv of invites) collected.push({ invite: inv, connectionId: conn.id });
      } catch (err) {
        logger.warn("listInvites failed", {
          event: "list_invites_failed",
          connectionId: conn.id,
          provider: conn.provider,
          err,
        });
      }
    }
  }
  if (collected.length === 0) return [];

  // Conflict detection: busy blocks (excluding the invite's own event) + bookings.
  const calendarIds = connections
    .flatMap((c) => c.calendars)
    .filter((c) => c.checkForConflicts)
    .map((c) => c.id);
  const [busy, bookings] = await Promise.all([
    calendarIds.length
      ? db.query.busyBlocks.findMany({
          where: and(
            inArray(schema.busyBlocks.calendarId, calendarIds),
            lte(schema.busyBlocks.startsAt, end),
            gte(schema.busyBlocks.endsAt, now),
          ),
          columns: { externalEventId: true, startsAt: true, endsAt: true },
        })
      : Promise.resolve([]),
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        eq(schema.bookings.status, "confirmed"),
        lte(schema.bookings.startsAt, end),
        gte(schema.bookings.endsAt, now),
      ),
      columns: { startsAt: true, endsAt: true },
    }),
  ]);

  return collected.map(({ invite, connectionId }) => {
    const s = invite.start.getTime();
    const e = invite.end.getTime();
    const overlaps = (bs: number, be: number) => bs < e && s < be;
    const hasConflict =
      busy.some(
        (b) =>
          b.externalEventId !== invite.externalEventId &&
          overlaps(b.startsAt.getTime(), b.endsAt.getTime()),
      ) || bookings.some((b) => overlaps(b.startsAt.getTime(), b.endsAt.getTime()));
    return { ...invite, connectionId, hasConflict };
  });
}

export type RespondResult = "ok" | "not_found" | "unsupported";

/** RSVP to an invitation on the user's behalf via the provider adapter. */
export async function respondToInvite(params: {
  userId: string;
  connectionId: string;
  calendarExternalId: string;
  externalEventId: string;
  response: InviteResponse;
}): Promise<RespondResult> {
  const db = getDb();
  const conn = await db.query.calendarConnections.findFirst({
    where: and(
      eq(schema.calendarConnections.id, params.connectionId),
      eq(schema.calendarConnections.userId, params.userId),
    ),
  });
  if (!conn) return "not_found";

  const adapter = await adapterForConnection(conn);
  if (!adapter.respondToInvite) return "unsupported";
  await adapter.respondToInvite(params.calendarExternalId, params.externalEventId, params.response);
  logger.info("invite responded", {
    event: "invite_responded",
    userId: params.userId,
    response: params.response,
  });
  return "ok";
}
