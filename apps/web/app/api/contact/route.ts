import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@calsync/core";
import { sendEmail } from "@calsync/emails";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
});

const SUPPORT = process.env.CONTACT_EMAIL ?? "hello@calsync.com";

/** Public contact form. Rate-limited; emails the team (best-effort). */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "contact", limit: 5, windowSec: 3600 });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const { name, email, message } = parsed.data;

  try {
    await sendEmail({
      to: SUPPORT,
      replyTo: email,
      subject: `Contact form — ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>${name}</strong> &lt;${email}&gt;</p><p>${message.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`,
    });
  } catch (err) {
    // Never fail the form on a mail hiccup — just log it.
    logger.error("contact email failed", { event: "contact_email_failed", err });
  }

  logger.info("contact submitted", { event: "contact_submitted", email });
  return NextResponse.json({ ok: true });
}
