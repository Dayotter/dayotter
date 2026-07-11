import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, ne, schema } from "@dayotter/db";
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
  "contact",
  "blog",
  "docs",
  "security",
  "self-hosting",
  "changelog",
  "status",
  "book",
  "embed.js",
]);

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  timezone: z.string().min(1).max(64),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
  /** Booking-page branding (optional). */
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour")
    .nullable()
    .optional(),
  welcomeMessage: z.string().max(280).nullable().optional(),
});

export const PATCH = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Check the highlighted fields", 400);
  }
  const { name, timezone, handle, brandColor, welcomeMessage } = parsed.data;

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

  // Persist booking-page branding onto the prefs row (upsert; only when provided).
  if (brandColor !== undefined || welcomeMessage !== undefined) {
    const branding = {
      ...(brandColor !== undefined ? { brandColor: brandColor || null } : {}),
      ...(welcomeMessage !== undefined ? { welcomeMessage: welcomeMessage?.trim() || null } : {}),
    };
    await db
      .insert(schema.userPreferences)
      .values({ userId: u.id, ...branding })
      .onConflictDoUpdate({ target: schema.userPreferences.userId, set: branding });
  }

  return NextResponse.json({ ok: true, handle });
});
