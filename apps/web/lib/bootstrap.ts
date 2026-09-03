import { and, eq, getDb, schema } from "@dayotter/db";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "user"
  );
}

async function uniqueValue(base: string, exists: (v: string) => Promise<boolean>): Promise<string> {
  if (!(await exists(base))) return base;
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Ensure a user has the minimum workspace to schedule: a personal organization
 * + owner membership, a public booking handle, and a default 9–5 schedule.
 * Idempotent - safe to call before any create action.
 */
export async function ensureUserWorkspace(userId: string): Promise<{
  organizationId: string;
  scheduleId: string;
  handle: string;
}> {
  const db = getDb();

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) throw new Error("User not found");

  // 1. Organization + membership.
  let membership = await db.query.memberships.findFirst({
    where: eq(schema.memberships.userId, userId),
  });
  if (!membership) {
    const base = slugify(user.name ?? user.email.split("@")[0] ?? "team");
    const slug = await uniqueValue(base, async (v) =>
      Boolean(await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, v) })),
    );
    const [org] = await db
      .insert(schema.organizations)
      .values({ name: user.name ? `${user.name}'s workspace` : "My workspace", slug })
      .returning();
    [membership] = await db
      .insert(schema.memberships)
      .values({ organizationId: org!.id, userId, role: "owner" })
      .returning();
  }

  // 2. Public handle.
  let handle = user.handle;
  if (!handle) {
    const base = slugify(user.name ?? user.email.split("@")[0] ?? "me");
    handle = await uniqueValue(base, async (v) =>
      Boolean(await db.query.users.findFirst({ where: eq(schema.users.handle, v) })),
    );
    await db.update(schema.users).set({ handle }).where(eq(schema.users.id, userId));
  }

  // 3. Default schedule (Mon–Fri 09:00–17:00).
  let schedule = await db.query.schedules.findFirst({
    where: and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)),
  });
  if (!schedule) {
    [schedule] = await db
      .insert(schema.schedules)
      .values({ userId, name: "Working hours", timezone: user.timezone, isDefault: true })
      .returning();
    await db.insert(schema.availabilityRules).values(
      [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        scheduleId: schedule!.id,
        dayOfWeek,
        startTime: "09:00:00",
        endTime: "17:00:00",
      })),
    );

    // 4. A starter event type, created once with the workspace, so a brand-new
    // user has a working, shareable booking link straight away - before (or
    // without) connecting a calendar. Tied to first bootstrap, so deleting all
    // event types later never resurrects one. Guarded in case one already exists.
    const hasEventType = await db.query.eventTypes.findFirst({
      where: eq(schema.eventTypes.ownerId, userId),
      columns: { id: true },
    });
    if (!hasEventType) {
      await db.insert(schema.eventTypes).values({
        organizationId: membership!.organizationId,
        ownerId: userId,
        scheduleId: schedule!.id,
        slug: "30min",
        title: "30 Minute Meeting",
        description: "A quick 30-minute call.",
        durationMinutes: 30,
      });
    }
  }

  return { organizationId: membership!.organizationId, scheduleId: schedule!.id, handle };
}
