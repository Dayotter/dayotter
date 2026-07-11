import { ensureUserWorkspace } from "@/lib/bootstrap";
import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { workflowBody } from "../route";

export const dynamic = "force-dynamic";

/** Load a workflow only if it belongs to the user's org. */
async function ownedWorkflow(userId: string, id: string) {
  const { organizationId } = await ensureUserWorkspace(userId);
  const w = await getDb().query.workflows.findFirst({
    where: and(eq(schema.workflows.id, id), eq(schema.workflows.organizationId, organizationId)),
  });
  return w ? { workflow: w, organizationId } : null;
}

/** Replace a workflow (and its event-type scoping). */
export const PUT = withUser(async (u, request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const owned = await ownedWorkflow(u.id, id);
  if (!owned) return jsonError("Not found", 404);

  const parsed = workflowBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid workflow", 400);
  }
  const d = parsed.data;

  // Only keep event-type ids owned by this org.
  const ownedTypes = await getDb().query.eventTypes.findMany({
    where: eq(schema.eventTypes.organizationId, owned.organizationId),
    columns: { id: true },
  });
  const ownedIds = new Set(ownedTypes.map((r) => r.id));
  const eventTypeIds = d.eventTypeIds.filter((etId) => ownedIds.has(etId));

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.workflows)
      .set({
        name: d.name,
        trigger: d.trigger,
        offsetMinutes: d.offsetMinutes,
        subjectTemplate: d.subjectTemplate.trim() || null,
        bodyTemplate: d.bodyTemplate,
        isActive: d.isActive,
      })
      .where(eq(schema.workflows.id, id));
    await tx.delete(schema.workflowEventTypes).where(eq(schema.workflowEventTypes.workflowId, id));
    if (eventTypeIds.length) {
      await tx
        .insert(schema.workflowEventTypes)
        .values(eventTypeIds.map((eventTypeId) => ({ workflowId: id, eventTypeId })));
    }
  });

  return NextResponse.json({ ok: true });
});

/** Delete a workflow. Its scheduled (unsent) messages cascade away. */
export const DELETE = withUser(async (u, _request, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const owned = await ownedWorkflow(u.id, id);
  if (!owned) return jsonError("Not found", 404);

  await getDb().delete(schema.workflows).where(eq(schema.workflows.id, id));
  return NextResponse.json({ ok: true });
});
