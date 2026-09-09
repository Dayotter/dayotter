import { and, eq, getDb, ne, schema } from "@dayotter/db";
import { type PollMessageTemplate, validatePollTemplate } from "./message-templates";
import { PollError } from "./polls";

/**
 * CRUD for a user's named, reusable poll meeting-details templates. All queries
 * are scoped to the userId so one host can never read/write another's templates.
 */

export async function listPollMessageTemplates(userId: string): Promise<PollMessageTemplate[]> {
  const rows = await getDb().query.pollMessageTemplates.findMany({
    where: eq(schema.pollMessageTemplates.userId, userId),
    orderBy: (t, { asc, desc }) => [desc(t.isDefault), asc(t.createdAt)],
  });
  return rows.map((r) => ({ id: r.id, name: r.name, body: r.body, isDefault: r.isDefault }));
}

export async function createPollMessageTemplate(
  userId: string,
  input: { name: string; body: string; isDefault?: boolean },
): Promise<PollMessageTemplate> {
  const error = validatePollTemplate(input);
  if (error) throw new PollError(error, 400);

  const db = getDb();
  const name = input.name.trim();
  const body = input.body.trim();

  const existing = await db.query.pollMessageTemplates.findFirst({
    where: and(
      eq(schema.pollMessageTemplates.userId, userId),
      eq(schema.pollMessageTemplates.name, name),
    ),
  });
  if (existing) throw new PollError("You already have a template with that name.", 409);

  // The first template becomes the default so the finalize editor always has
  // something sensible to pre-fill; later ones only on request.
  const hasAny = Boolean(
    await db.query.pollMessageTemplates.findFirst({
      where: eq(schema.pollMessageTemplates.userId, userId),
    }),
  );
  const isDefault = input.isDefault ?? !hasAny;

  return db.transaction(async (tx) => {
    if (isDefault) {
      await tx
        .update(schema.pollMessageTemplates)
        .set({ isDefault: false })
        .where(eq(schema.pollMessageTemplates.userId, userId));
    }
    const [row] = await tx
      .insert(schema.pollMessageTemplates)
      .values({ userId, name, body, isDefault })
      .returning();
    if (!row) throw new PollError("Could not save template", 500);
    return { id: row.id, name: row.name, body: row.body, isDefault: row.isDefault };
  });
}

export async function updatePollMessageTemplate(
  userId: string,
  templateId: string,
  input: { name?: string; body?: string; isDefault?: boolean },
): Promise<void> {
  const db = getDb();
  const existing = await db.query.pollMessageTemplates.findFirst({
    where: and(
      eq(schema.pollMessageTemplates.id, templateId),
      eq(schema.pollMessageTemplates.userId, userId),
    ),
  });
  if (!existing) throw new PollError("Template not found", 404);

  const name = input.name?.trim() ?? existing.name;
  const body = input.body?.trim() ?? existing.body;
  const error = validatePollTemplate({ name, body });
  if (error) throw new PollError(error, 400);

  if (name !== existing.name) {
    const dup = await db.query.pollMessageTemplates.findFirst({
      where: and(
        eq(schema.pollMessageTemplates.userId, userId),
        eq(schema.pollMessageTemplates.name, name),
        ne(schema.pollMessageTemplates.id, templateId),
      ),
    });
    if (dup) throw new PollError("You already have a template with that name.", 409);
  }

  const isDefault = input.isDefault ?? existing.isDefault;
  await db.transaction(async (tx) => {
    if (isDefault && !existing.isDefault) {
      await tx
        .update(schema.pollMessageTemplates)
        .set({ isDefault: false })
        .where(
          and(
            eq(schema.pollMessageTemplates.userId, userId),
            ne(schema.pollMessageTemplates.id, templateId),
          ),
        );
    }
    await tx
      .update(schema.pollMessageTemplates)
      .set({ name, body, isDefault })
      .where(eq(schema.pollMessageTemplates.id, templateId));
  });
}

export async function deletePollMessageTemplate(userId: string, templateId: string): Promise<void> {
  const db = getDb();
  const existing = await db.query.pollMessageTemplates.findFirst({
    where: and(
      eq(schema.pollMessageTemplates.id, templateId),
      eq(schema.pollMessageTemplates.userId, userId),
    ),
  });
  if (!existing) throw new PollError("Template not found", 404);

  await db
    .delete(schema.pollMessageTemplates)
    .where(eq(schema.pollMessageTemplates.id, templateId));

  // Keep exactly one default: promote the newest remaining template if the
  // deleted one was the default.
  if (existing.isDefault) {
    const next = await db.query.pollMessageTemplates.findFirst({
      where: eq(schema.pollMessageTemplates.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    if (next) {
      await db
        .update(schema.pollMessageTemplates)
        .set({ isDefault: true })
        .where(eq(schema.pollMessageTemplates.id, next.id));
    }
  }
}
