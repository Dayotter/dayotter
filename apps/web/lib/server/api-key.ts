import { sha256hex } from "@calsync/core";
import { and, eq, getDb, isNull, schema } from "@calsync/db";
import { jsonError } from "./http";

/** Prefix that marks a calSync API key; the rest is 32 random bytes (base64url). */
export const API_KEY_PREFIX = "csk_live_";

export interface ApiCaller {
  userId: string;
  keyId: string;
}

type ApiHandler<Ctx> = (
  caller: ApiCaller,
  request: Request,
  ctx: Ctx,
) => Promise<Response> | Response;

/**
 * Wrap a public REST API route so it authenticates with an API key from the
 * `Authorization: Bearer csk_live_…` header. Only the SHA-256 hash is stored, so
 * we hash the presented key and look it up. Revoked keys are excluded. Touches
 * `lastUsedAt` (best-effort) so the UI can show recent activity.
 */
export function withApiKey<Ctx = unknown>(handler: ApiHandler<Ctx>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token.startsWith(API_KEY_PREFIX)) {
      return jsonError("Missing or malformed API key", 401);
    }

    const db = getDb();
    const row = await db.query.apiKeys.findFirst({
      where: and(eq(schema.apiKeys.keyHash, sha256hex(token)), isNull(schema.apiKeys.revokedAt)),
      columns: { id: true, userId: true },
    });
    if (!row) return jsonError("Invalid API key", 401);

    db.update(schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiKeys.id, row.id))
      .catch(() => {});

    return handler({ userId: row.userId, keyId: row.id }, request, ctx);
  };
}
