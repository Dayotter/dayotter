import {
  RoutingError,
  deleteForm,
  getFormForHost,
  hostEventTypes,
  updateForm,
} from "@/lib/routing/routing";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** A routing form's full definition + the host's event types (mobile detail). */
export const GET = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const form = await getFormForHost(id, u.id);
  if (!form) return jsonError("Form not found", 404);
  return NextResponse.json({ form, eventTypes: await hostEventTypes(u.id) });
});

const fieldSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(160),
  type: z.enum(["select", "text", "email"]),
  options: z.array(z.string().max(120)).max(30).optional(),
  required: z.boolean().optional(),
});

const routeSchema = z.object({
  id: z.string().min(1).max(64),
  fieldId: z.string().min(1).max(64),
  equals: z.string().max(120),
  eventTypeId: z.string().uuid(),
});

const bodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).nullish(),
  isActive: z.boolean(),
  fields: z.array(fieldSchema).max(20),
  routes: z.array(routeSchema).max(40),
  fallbackEventTypeId: z.string().uuid().nullish(),
});

export const PUT = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid form", 400);
  try {
    await updateForm(id, u.id, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      isActive: parsed.data.isActive,
      fields: parsed.data.fields,
      routes: parsed.data.routes,
      fallbackEventTypeId: parsed.data.fallbackEventTypeId ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RoutingError) return jsonError(err.message, err.status);
    throw err;
  }
});

export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const ok = await deleteForm(id, u.id);
  if (!ok) return jsonError("Form not found", 404);
  return NextResponse.json({ ok: true });
});
