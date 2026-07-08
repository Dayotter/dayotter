import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, ne, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Handles that would shadow app routes and must not be claimed as booking handles. */
const RESERVED_HANDLES = new Set([
  "api",
  "app",
  "dashboard",
  "settings",
  "event-types",
  "availability",
  "bookings",
  "booking",
  "teams",
  "team",
  "sign-in",
  "sign-up",
  "admin",
  "help",
  "about",
  "pricing",
  "terms",
  "privacy",
]);

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  timezone: z.string().min(1).max(64),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
});

export const PATCH = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the highlighted fields", 400);
  const { name, timezone, handle } = parsed.data;

  if (RESERVED_HANDLES.has(handle)) {
    return jsonError("That handle is reserved. Try another.", 409);
  }

  const db = getDb();
  const taken = await db.query.users.findFirst({
    where: and(eq(schema.users.handle, handle), ne(schema.users.id, u.id)),
    columns: { id: true },
  });
  if (taken) return jsonError("That handle is already taken.", 409);

  await db.update(schema.users).set({ name, timezone, handle }).where(eq(schema.users.id, u.id));
  return NextResponse.json({ ok: true, handle });
});
