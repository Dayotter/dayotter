import { and, eq, getDb, schema } from "@calsync/db";

/**
 * Resolve the schedule an event type should use: the requested one if it belongs
 * to the user, otherwise the user's default schedule. Prevents pointing an event
 * type at another user's availability.
 */
export async function resolveScheduleId(
  userId: string,
  requested: string | null | undefined,
): Promise<string | null> {
  const db = getDb();
  if (requested) {
    const owned = await db.query.schedules.findFirst({
      where: and(eq(schema.schedules.id, requested), eq(schema.schedules.userId, userId)),
      columns: { id: true },
    });
    if (owned) return requested;
  }
  const def = await db.query.schedules.findFirst({
    where: and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)),
    columns: { id: true },
  });
  return def?.id ?? null;
}
