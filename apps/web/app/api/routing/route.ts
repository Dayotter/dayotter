import { RoutingError, createForm } from "@/lib/routing/routing";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid form", 400);
  try {
    const { id } = await createForm(u.id, parsed.data);
    return NextResponse.json({ id, url: `/routing/${id}` });
  } catch (err) {
    if (err instanceof RoutingError) return jsonError(err.message, err.status);
    throw err;
  }
});
