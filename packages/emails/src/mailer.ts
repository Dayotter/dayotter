import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const url = process.env.SMTP_URL;
  // Dev fallback: JSON transport logs the message instead of sending.
  transporter = url
    ? nodemailer.createTransport(url)
    : nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

export interface OutboundEmail {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Reply-To header (e.g. a contact-form sender's address). */
  replyTo?: string;
}

/**
 * Send through Resend's HTTP API. Preferred when RESEND_API_KEY is set — it
 * needs no SMTP URL wrangling, just the key + a verified `EMAIL_FROM` domain.
 */
async function sendViaResend(email: OutboundEmail, from: string, apiKey: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      reply_to: email.replyTo,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Surface the reason (unverified domain, bad key, etc.) — callers log it.
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Deliver an email. Transport is chosen by what's configured, in order:
 *   1. RESEND_API_KEY  → Resend HTTP API
 *   2. SMTP_URL        → SMTP (nodemailer)
 *   3. neither         → warn loudly and drop (so a missing config surfaces in
 *      logs instead of silently swallowing every confirmation/reminder).
 */
export async function sendEmail(email: OutboundEmail): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "DayOtter <no-reply@example.com>";

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    await sendViaResend(email, from, resendKey);
    return;
  }

  if (process.env.SMTP_URL) {
    await getTransporter().sendMail({ from, ...email });
    return;
  }

  console.warn(
    `[emails] No RESEND_API_KEY or SMTP_URL configured — NOT sending "${email.subject}" to ${JSON.stringify(email.to)}`,
  );
}
