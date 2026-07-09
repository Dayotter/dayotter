import { API_KEY_PREFIX } from "@/lib/server/api-key";
import { jsonError, withUser } from "@/lib/server/http";
import { randomToken, sha256hex } from "@calsync/core";
import { asc, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** List the user's API keys (never the secret — only the display prefix). */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.apiKeys.findMany({
    where: eq(schema.apiKeys.userId, u.id),
    orderBy: asc(schema.apiKeys.createdAt),
  });
  return NextResponse.json({
    keys: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
});

const body = z.object({ name: z.string().min(1).max(80) });

/** Create an API key. Returns the full secret ONCE — it's only stored hashed. */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Name is required", 400);

  const secret = `${API_KEY_PREFIX}${randomToken(24)}`;
  const prefix = `${secret.slice(0, API_KEY_PREFIX.length + 6)}…`;

  const [created] = await getDb()
    .insert(schema.apiKeys)
    .values({
      userId: u.id,
      name: parsed.data.name,
      prefix,
      keyHash: sha256hex(secret),
    })
    .returning();

  return NextResponse.json({
    key: {
      id: created!.id,
      name: created!.name,
      prefix: created!.prefix,
      createdAt: created!.createdAt.toISOString(),
    },
    // Shown once; the client must copy it now.
    secret,
  });
});
