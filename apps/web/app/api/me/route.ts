import { aiEnabled } from "@/lib/ai/llm";
import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Current user + profile + server capabilities. The mobile app calls this after sign-in. */
export const GET = withUser(async (u) => {
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { id: true, name: true, email: true, image: true, handle: true, timezone: true },
  });
  if (!user) return jsonError("Not found", 404);
  return NextResponse.json({ user, aiEnabled });
});
