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
}

export async function sendEmail(email: OutboundEmail): Promise<void> {
  const from = process.env.EMAIL_FROM ?? "calSync <no-reply@example.com>";
  const info = await getTransporter().sendMail({ from, ...email });
  if (!process.env.SMTP_URL) {
    console.log(`[emails] (no SMTP) → ${JSON.stringify(email.to)}: ${email.subject}`);
  }
  return void info;
}
