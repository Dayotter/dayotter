import { AppleConnectError, connectAppleAccount } from "@/lib/calendar/calendar-connect";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  username: z.string().email("Enter your Apple ID email"),
  password: z.string().min(1, "Enter your app-specific password"),
  serverUrl: z.string().url().optional(),
});

/**
 * Connect an Apple iCloud / CalDAV account with an app-specific password. Unlike
 * OAuth this is a direct form post (no redirect); we verify the credentials
 * synchronously so the user gets immediate feedback.
 */
export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid details", 400);
  }

  try {
    const result = await connectAppleAccount({
      userId: u.id,
      credentials: {
        username: parsed.data.username.trim(),
        // Apple shows app-specific passwords with spaces; they must be stripped.
        password: parsed.data.password.replace(/\s+/g, ""),
        serverUrl: parsed.data.serverUrl,
      },
    });
    return NextResponse.json({ ok: true, calendarCount: result.calendarCount });
  } catch (err) {
    if (err instanceof AppleConnectError) return jsonError(err.message, 400);
    console.error("[calendars/apple] connect failed:", err);
    return jsonError("Could not connect. Please try again.", 500);
  }
});
