/**
 * Send ONE lifecycle email to ONE address, for previewing. Does not touch the
 * batch, the ledger, or any user - it just renders the chosen template with
 * sample data and sends it through the normal mailer (Resend / SMTP), so you can
 * see exactly what a real recipient would get.
 *
 *   pnpm --filter @dayotter/worker email:preview you@example.com share_link
 *
 * Kinds: share_link | connect_calendar | first_booking | weekly_digest
 * Needs RESEND_API_KEY (or SMTP_URL) + EMAIL_FROM set, same as any email.
 */
import {
  activationConnectCalendar,
  activationShareLink,
  firstBookingCelebration,
  sendEmail,
  weeklyDigest,
} from "@dayotter/emails";

const KINDS = ["share_link", "connect_calendar", "first_booking", "weekly_digest"] as const;
type Kind = (typeof KINDS)[number];

async function main() {
  const [to, kindArg] = process.argv.slice(2);
  const kind = kindArg as Kind;
  if (!to || !KINDS.includes(kind)) {
    console.error(`Usage: email:preview <to-email> <${KINDS.join(" | ")}>`);
    process.exit(1);
  }

  const base = (process.env.APP_URL ?? "https://dayotter.com").replace(/\/$/, "");
  const activation = {
    name: "there",
    bookingUrl: `${base}/you`,
    manageUrl: `${base}/dashboard`,
    // A dead sample link - preview only, so it doesn't unsubscribe anyone real.
    unsubscribeUrl: `${base}/api/email/unsubscribe?u=preview&t=preview`,
  };

  const email =
    kind === "share_link"
      ? activationShareLink(activation)
      : kind === "connect_calendar"
        ? activationConnectCalendar(activation)
        : kind === "first_booking"
          ? firstBookingCelebration(activation)
          : weeklyDigest({
              name: "there",
              meetings: 4,
              hours: 2.5,
              focusHours: 6,
              upcoming: 2,
              manageUrl: activation.manageUrl,
              unsubscribeUrl: activation.unsubscribeUrl,
            });

  await sendEmail({ to, ...email });
  console.log(`Sent "${kind}" preview to ${to} (subject: ${email.subject}).`);
}

main().catch((err) => {
  console.error("email:preview failed:", err);
  process.exit(1);
});
