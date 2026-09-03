import { hmacSha256hex, safeEqual } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

function page(message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>DayOtter</title>
     <div style="max-width:420px;margin:12vh auto;font-family:ui-sans-serif,system-ui,sans-serif;text-align:center;color:#0c0e14">
       <h1 style="font-size:18px">${message}</h1>
       <p style="color:#6b7280;font-size:14px">You'll still get transactional emails (booking confirmations, reminders). You can turn tips back on any time in Settings.</p>
     </div>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * One-click unsubscribe from lifecycle/product emails. No login: the link carries
 * an HMAC over the user id (same secret the worker signs with), so it can't be
 * forged. Flips `productEmails` off; transactional emails are unaffected.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const expected = hmacSha256hex(process.env.AUTH_SECRET ?? "", `unsub:${userId}`);
  if (!userId || !token || !safeEqual(token, expected)) {
    return page("This unsubscribe link isn't valid.");
  }

  const db = getDb();
  // Upsert so a user with no preferences row still gets opted out.
  await db
    .insert(schema.userPreferences)
    .values({ userId, productEmails: false })
    .onConflictDoUpdate({
      target: schema.userPreferences.userId,
      set: { productEmails: false },
    });

  return page("You're unsubscribed from DayOtter tips.");
}
