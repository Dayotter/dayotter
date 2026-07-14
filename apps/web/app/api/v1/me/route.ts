import { withApiKey } from "@/lib/server/api-key";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/me - the authenticated account. */
export const GET = withApiKey(async (caller) => {
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, caller.userId),
    columns: { id: true, email: true, name: true, handle: true, timezone: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
});
