import { BookingError, type CreateBookingInput, createBooking } from "@/lib/booking/create-booking";
import { chargeFor } from "@/lib/booking/money";
import { stashPendingBooking } from "@/lib/payments/pending";
import { createCheckoutSession, paymentsEnabled } from "@/lib/payments/stripe";
import { clientIp, enforceRateLimit, verifyCaptcha } from "@/lib/server/rate-limit";
import { schema as db, eq, getDb } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventTypeId: z.string().uuid(),
  start: z.string().datetime(),
  attendee: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    timezone: z.string().min(1),
  }),
  guests: z.array(z.string().email()).max(10).optional(),
  notes: z.string().max(2000).optional(),
  responses: z.record(z.unknown()).optional(),
  durationMinutes: z.number().int().min(5).max(1440).optional(),
  captchaToken: z.string().max(4000).optional(),
  /** Where to send the booker if they abandon Stripe Checkout. */
  returnPath: z.string().max(400).optional(),
});

export async function POST(request: Request) {
  // Creating a booking is expensive (availability recompute, calendar write,
  // emails) — throttle hard per IP and require captcha when enabled.
  const limited = await enforceRateLimit(request, { name: "book", limit: 10, windowSec: 600 });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await verifyCaptcha(parsed.data.captchaToken, clientIp(request)))) {
    return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
  }

  // Extra per-attendee cooldown: block hammering the same event with one email.
  const cooldown = await enforceRateLimit(request, {
    name: "book-attendee",
    limit: 5,
    windowSec: 600,
    key: `${parsed.data.eventTypeId}:${parsed.data.attendee.email.toLowerCase()}`,
  });
  if (cooldown) return cooldown;

  const input: CreateBookingInput = {
    eventTypeId: parsed.data.eventTypeId,
    start: parsed.data.start,
    attendee: parsed.data.attendee,
    guests: parsed.data.guests,
    notes: parsed.data.notes,
    responses: parsed.data.responses,
    durationMinutes: parsed.data.durationMinutes,
  };

  // Paid event type → collect payment via Stripe Checkout first; the booking is
  // only created once the payment succeeds (in /booking/paid + the webhook).
  if (paymentsEnabled) {
    const et = await getDb().query.eventTypes.findFirst({
      where: eq(db.eventTypes.id, parsed.data.eventTypeId),
      columns: { title: true, price: true, currency: true, depositAmount: true, isActive: true },
    });
    const amount = chargeFor(et?.price ?? null, et?.depositAmount ?? null);
    if (et?.isActive && amount > 0) {
      try {
        const token = await stashPendingBooking(input);
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        const returnPath = parsed.data.returnPath?.startsWith("/") ? parsed.data.returnPath : "/";
        const { url } = await createCheckoutSession({
          amount,
          currency: et.currency ?? "usd",
          productName: et.title,
          successUrl: `${appUrl}/booking/paid?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${appUrl}${returnPath}`,
          customerEmail: parsed.data.attendee.email,
          metadata: { token },
        });
        return NextResponse.json({ checkoutUrl: url });
      } catch (err) {
        console.error("[api/book] checkout error:", err);
        return NextResponse.json({ error: "Couldn't start checkout" }, { status: 502 });
      }
    }
  }

  try {
    const { uid, redirectUrl } = await createBooking(input);
    return NextResponse.json({ uid, url: `/booking/${uid}`, redirectUrl });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/book] unexpected error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
