import { BookingError, createBooking } from "@/lib/booking/create-booking";
import { clientIp, enforceRateLimit, verifyCaptcha } from "@/lib/server/rate-limit";
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
  captchaToken: z.string().max(4000).optional(),
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

  try {
    const { uid } = await createBooking(parsed.data);
    return NextResponse.json({ uid, url: `/booking/${uid}` });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/book] unexpected error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
