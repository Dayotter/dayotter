import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { sendEmail } from "@dayotter/emails";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
});

const SUPPORT = process.env.CONTACT_EMAIL ?? "hello@dayotter.com";

/** Public contact form. Rate-limited; emails the team (best-effort). */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "contact", limit: 5, windowSec: 3600 });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const { name, email, message } = parsed.data;

  // Persist FIRST so a mail outage never loses the message: the row is the
  // source of truth; the email is a best-effort notification on top of it.
  const db = getDb();
  let submissionId: string;
  try {
    const [row] = await db
      .insert(schema.contactSubmissions)
      .values({ name, email, message })
      .returning({ id: schema.contactSubmissions.id });
    submissionId = row!.id;
  } catch (err) {
    // If we can't even store it, tell the sender rather than pretending it sent.
    logger.error("contact submission persist failed", { event: "contact_persist_failed", err });
    return NextResponse.json(
      { error: "We couldn't record your message. Please try again shortly." },
      { status: 503 },
    );
  }

  // Best-effort notification. A failure no longer loses the message - it stays
  // in the table with a null emailedAt for follow-up.
  try {
    await sendEmail({
      to: SUPPORT,
      replyTo: email,
      subject: `Contact form - ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>${name}</strong> &lt;${email}&gt;</p><p>${message.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`,
    });
    await db
      .update(schema.contactSubmissions)
      .set({ emailedAt: new Date() })
      .where(eq(schema.contactSubmissions.id, submissionId));
  } catch (err) {
    logger.error("contact email failed", { event: "contact_email_failed", submissionId, err });
  }

  logger.info("contact submitted", { event: "contact_submitted", submissionId, email });
  return NextResponse.json({ ok: true });
}
