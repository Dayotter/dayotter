import { requireFeature } from "@/lib/billing/require-feature";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { jsonError, withUser } from "@/lib/server/http";
import { asc, eq, getDb, inArray, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Event-type ids owned by the user's org — used to validate workflow scoping. */
async function ownedEventTypeIds(organizationId: string): Promise<Set<string>> {
  const rows = await getDb().query.eventTypes.findMany({
    where: eq(schema.eventTypes.organizationId, organizationId),
    columns: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

function serialize(w: typeof schema.workflows.$inferSelect, eventTypeIds: string[]) {
  return {
    id: w.id,
    name: w.name,
    trigger: w.trigger,
    offsetMinutes: w.offsetMinutes,
    action: w.action,
    subjectTemplate: w.subjectTemplate ?? "",
    bodyTemplate: w.bodyTemplate ?? "",
    isActive: w.isActive,
    eventTypeIds,
  };
}

/** The user's org workflows, each with its event-type scoping. */
export const GET = withUser(async (u) => {
  const { organizationId } = await ensureUserWorkspace(u.id);
  const db = getDb();
  const rows = await db.query.workflows.findMany({
    where: eq(schema.workflows.organizationId, organizationId),
    orderBy: asc(schema.workflows.createdAt),
  });
  const maps = rows.length
    ? await db.query.workflowEventTypes.findMany({
        where: inArray(
          schema.workflowEventTypes.workflowId,
          rows.map((r) => r.id),
        ),
      })
    : [];
  const byWorkflow = new Map<string, string[]>();
  for (const m of maps) {
    byWorkflow.set(m.workflowId, [...(byWorkflow.get(m.workflowId) ?? []), m.eventTypeId]);
  }
  return NextResponse.json({
    workflows: rows.map((w) => serialize(w, byWorkflow.get(w.id) ?? [])),
  });
});

export const workflowBody = z.object({
  name: z.string().min(1).max(120),
  // Only the time-based triggers are wired to delivery today.
  trigger: z.enum(["before_event", "after_event"]).default("before_event"),
  offsetMinutes: z.number().int().min(0).max(43_200).default(60),
  subjectTemplate: z.string().max(300).default(""),
  bodyTemplate: z.string().min(1).max(5000),
  isActive: z.boolean().default(true),
  /** Empty = applies to every event type. */
  eventTypeIds: z.array(z.string().uuid()).max(100).default([]),
});

/** Create a workflow. */
export const POST = withUser(async (u, request) => {
  const gate = await requireFeature(u.id, "workflows");
  if (gate) return gate;
  const { organizationId } = await ensureUserWorkspace(u.id);

  const parsed = workflowBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid workflow", 400);
  }
  const d = parsed.data;

  // Drop any event-type ids the org doesn't own (no cross-tenant scoping).
  const owned = await ownedEventTypeIds(organizationId);
  const eventTypeIds = d.eventTypeIds.filter((id) => owned.has(id));

  const db = getDb();
  const created = await db.transaction(async (tx) => {
    const [w] = await tx
      .insert(schema.workflows)
      .values({
        organizationId,
        name: d.name,
        trigger: d.trigger,
        offsetMinutes: d.offsetMinutes,
        action: "email",
        subjectTemplate: d.subjectTemplate.trim() || null,
        bodyTemplate: d.bodyTemplate,
        isActive: d.isActive,
      })
      .returning();
    if (eventTypeIds.length) {
      await tx
        .insert(schema.workflowEventTypes)
        .values(eventTypeIds.map((eventTypeId) => ({ workflowId: w!.id, eventTypeId })));
    }
    return w!;
  });

  return NextResponse.json({ workflow: serialize(created, eventTypeIds) });
});
