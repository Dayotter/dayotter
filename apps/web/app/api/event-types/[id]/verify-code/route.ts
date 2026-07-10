import { enforceRateLimit } from "@/lib/server/rate-limit";
import { safeEqual, sha256hex } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().min(1).max(64) });

/**
 * Public check of an event type's access code (password-protected links). Returns
 * only { ok }, never the hash. Rate-limited to blunt brute-forcing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(request, {
    name: "verify-code",
    limit: 20,
    windowSec: 300,
  });
  if (limited) return limited;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const et = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, id),
    columns: { accessCodeHash: true },
  });
  // No code required → any code is "ok" (nothing to gate).
  if (!et?.accessCodeHash) return NextResponse.json({ ok: true });

  const ok = safeEqual(sha256hex(parsed.data.code.trim()), et.accessCodeHash);
  return NextResponse.json({ ok });
}
