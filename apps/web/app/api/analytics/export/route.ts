import { requireFeature } from "@/lib/billing/require-feature";
import { withUser } from "@/lib/server/http";
import { and, eq, getDb, gte, lt, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

/**
 * RFC-4180 field escaping + spreadsheet formula-injection defense: attendee-
 * controlled text starting with = + - @ (or a control char) is prefixed with a
 * single quote so Excel/Sheets treat it as text, not a formula.
 */
function cell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "booking_uid",
  "event_type",
  "status",
  "payment_status",
  "amount_paid",
  "currency",
  "created_at",
  "starts_at",
  "ends_at",
  "timezone",
  "attendee_name",
  "attendee_email",
] as const;

/** Export the host's bookings in a window as CSV (one row per attendee). */
export const GET = withUser(async (u, request) => {
  const gate = await requireFeature(u.id, "analytics");
  if (gate) return gate;
  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const rows = await getDb().query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, u.id),
      gte(schema.bookings.createdAt, from),
      lt(schema.bookings.createdAt, to),
    ),
    with: { attendees: true, eventType: { columns: { title: true } } },
    orderBy: (b, { desc }) => [desc(b.createdAt)],
  });

  const lines = [HEADERS.join(",")];
  for (const b of rows) {
    const attendees = b.attendees.length > 0 ? b.attendees : [{ name: null, email: "" }];
    for (const a of attendees) {
      lines.push(
        [
          b.uid,
          b.eventType?.title ?? "",
          b.status,
          b.paymentStatus,
          b.amountPaid != null ? (b.amountPaid / 100).toFixed(2) : "",
          b.paymentCurrency ?? "",
          b.createdAt.toISOString(),
          b.startsAt.toISOString(),
          b.endsAt.toISOString(),
          b.timezone,
          a.name,
          a.email,
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  const stamp = to.toISOString().slice(0, 10);
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="dayotter-bookings-${stamp}.csv"`,
    },
  });
});
