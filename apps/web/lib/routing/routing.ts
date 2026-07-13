import { randomBytes } from "node:crypto";
import { and, asc, eq, getDb, inArray, schema } from "@dayotter/db";
import type { RoutingField, RoutingRoute } from "@dayotter/db";

export class RoutingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Active event types owned by the host — the routing targets shown in the builder. */
export async function hostEventTypes(hostId: string) {
  return getDb().query.eventTypes.findMany({
    where: and(eq(schema.eventTypes.ownerId, hostId), eq(schema.eventTypes.isActive, true)),
    columns: { id: true, title: true, slug: true },
    orderBy: asc(schema.eventTypes.title),
  });
}

/** Create an empty form; the host fills in fields + routes in the builder. */
export async function createForm(
  hostId: string,
  input: { title: string; description?: string },
): Promise<{ id: string; token: string }> {
  const token = randomBytes(9).toString("base64url");
  const [form] = await getDb()
    .insert(schema.routingForms)
    .values({
      hostId,
      title: input.title.trim() || "Untitled form",
      description: input.description?.trim() || null,
      token,
      fields: [],
      routes: [],
    })
    .returning();
  if (!form) throw new RoutingError("Could not create form", 500);
  return { id: form.id, token: form.token };
}

export async function getFormForHost(id: string, hostId: string) {
  const form = await getDb().query.routingForms.findFirst({
    where: and(eq(schema.routingForms.id, id), eq(schema.routingForms.hostId, hostId)),
    with: { responses: true },
  });
  return form ?? null;
}

export async function listForms(hostId: string) {
  return getDb().query.routingForms.findMany({
    where: eq(schema.routingForms.hostId, hostId),
    orderBy: (f, { desc }) => desc(f.createdAt),
    with: { responses: { columns: { id: true } } },
  });
}

export interface UpdateFormInput {
  title: string;
  description?: string | null;
  isActive: boolean;
  fields: RoutingField[];
  routes: RoutingRoute[];
  fallbackEventTypeId: string | null;
}

export async function updateForm(
  id: string,
  hostId: string,
  input: UpdateFormInput,
): Promise<void> {
  const db = getDb();
  const form = await db.query.routingForms.findFirst({
    where: and(eq(schema.routingForms.id, id), eq(schema.routingForms.hostId, hostId)),
    columns: { id: true },
  });
  if (!form) throw new RoutingError("Form not found", 404);

  // Only allow routing to event types the host actually owns.
  const owned = new Set((await hostEventTypes(hostId)).map((e) => e.id));
  const fieldIds = new Set(input.fields.map((f) => f.id));
  const routes = input.routes.filter((r) => fieldIds.has(r.fieldId) && owned.has(r.eventTypeId));
  const fallback =
    input.fallbackEventTypeId && owned.has(input.fallbackEventTypeId)
      ? input.fallbackEventTypeId
      : null;

  await db
    .update(schema.routingForms)
    .set({
      title: input.title.trim() || "Untitled form",
      description: input.description?.trim() || null,
      isActive: input.isActive,
      fields: input.fields,
      routes,
      fallbackEventTypeId: fallback,
    })
    .where(eq(schema.routingForms.id, id));
}

/** Public: the active form for the voting/booking page. */
export async function getFormByToken(token: string) {
  const form = await getDb().query.routingForms.findFirst({
    where: eq(schema.routingForms.token, token),
    with: { host: { columns: { name: true } } },
  });
  return form?.isActive ? form : null;
}

/**
 * Evaluate a submission against the form's ordered routes and return the booking
 * path for the matched event type. Records the response for the results view.
 */
export async function submitAndRoute(
  token: string,
  answers: Record<string, string>,
): Promise<{ url: string }> {
  const db = getDb();
  const form = await db.query.routingForms.findFirst({
    where: eq(schema.routingForms.token, token),
  });
  if (!form || !form.isActive) throw new RoutingError("Form not found", 404);

  // Required-field check (server-side; the client validates too).
  const missing = form.fields.find((f) => f.required && !answers[f.id]?.trim());
  if (missing) throw new RoutingError(`Please answer "${missing.label}".`, 400);

  // First matching route wins; else the fallback.
  const matched = form.routes.find((r) => (answers[r.fieldId] ?? "").trim() === r.equals);
  const targetId = matched?.eventTypeId ?? form.fallbackEventTypeId ?? null;
  if (!targetId) {
    throw new RoutingError("Thanks! There's no booking page to send you to yet.", 409);
  }

  const target = await db.query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, targetId),
    columns: { slug: true, ownerId: true, isActive: true },
  });
  const owner = target?.ownerId
    ? await db.query.users.findFirst({
        where: eq(schema.users.id, target.ownerId),
        columns: { handle: true },
      })
    : null;
  if (!target || !target.isActive || !owner?.handle) {
    throw new RoutingError("The matching booking page isn't available.", 409);
  }

  await db.insert(schema.routingFormResponses).values({
    formId: form.id,
    answers,
    routedEventTypeId: targetId,
  });

  return { url: `/${owner.handle}/${target.slug}` };
}

/** Resolve event-type ids → titles for the builder/results (labels for routes). */
export async function eventTypeTitles(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb().query.eventTypes.findMany({
    where: inArray(schema.eventTypes.id, ids),
    columns: { id: true, title: true },
  });
  return new Map(rows.map((r) => [r.id, r.title]));
}
