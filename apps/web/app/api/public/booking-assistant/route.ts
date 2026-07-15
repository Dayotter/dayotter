import { GUARDRAIL_PREAMBLE, SCOPE_REFUSAL, screenUserInput } from "@/lib/ai/guardrails";
import { aiEnabled, extract } from "@/lib/ai/llm";
import { getEventTypeAvailability } from "@/lib/booking/availability";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { eq, getDb, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({
  eventTypeId: z.string().uuid(),
  query: z.string().min(1).max(300),
  tz: z.string().min(1).max(64),
});

const SYSTEM = `${GUARDRAIL_PREAMBLE}

You help a visitor choose a meeting time on a public booking page. You get the visitor's request and a NUMBERED list of the host's OPEN slots (all already free). Pick up to 5 slots that best fit the request - day of week, time of day, "soonest", "next week", etc. ONLY choose from the given slots; never invent times. Reply with one short, warm sentence and the chosen slot numbers. If nothing matches, return an empty list and say so kindly. Stay strictly on picking a time - refuse anything else.`;

const OUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string" },
    picks: { type: "array", items: { type: "integer" }, maxItems: 5 },
  },
  required: ["message", "picks"],
} as const;

const parseOut = z.object({
  message: z.string().max(400),
  picks: z.array(z.number().int()).max(5),
});

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, {
    name: "booking-assistant",
    limit: 15,
    windowSec: 300,
  });
  if (limited) return limited;
  if (!aiEnabled) return NextResponse.json({ error: "unavailable" }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { eventTypeId, query, tz } = parsed.data;

  const et = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, eventTypeId),
    columns: { ownerId: true, isActive: true },
  });
  if (!et?.isActive || !et.ownerId) {
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  }
  // The host can turn this helper off for their booking page.
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, et.ownerId),
    columns: { bookingPageAssistant: true },
  });
  if (prefs && prefs.bookingPageAssistant === false) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  // Guardrail the untrusted visitor input.
  if (screenUserInput(query).blocked) {
    return NextResponse.json({ message: SCOPE_REFUSAL, slots: [] });
  }

  const from = new Date();
  const to = new Date(from.getTime() + 14 * 86_400_000);
  const slots = (await getEventTypeAvailability(eventTypeId, from, to)) ?? [];
  if (slots.length === 0) {
    return NextResponse.json({
      message: "There aren't any open times in the next two weeks just now.",
      slots: [],
    });
  }

  // Cap the list fed to the model; label each in the visitor's timezone.
  const capped = slots.slice(0, 60);
  const zone = DateTime.now().setZone(tz).isValid ? tz : "UTC";
  const numbered = capped
    .map(
      (s, i) =>
        `#${i}: ${DateTime.fromJSDate(s.start).setZone(zone).toFormat("ccc, LLL d 'at' h:mm a")}`,
    )
    .join("\n");

  try {
    const out = await extract({
      system: SYSTEM,
      user: `Visitor's request: "${query}"\n\nOpen slots:\n${numbered}`,
      inputSchema: OUT_SCHEMA as unknown as Record<string, unknown>,
      parse: (v) => parseOut.parse(v),
      feature: "booking_assistant",
      tier: "fast",
      cacheSystem: true,
    });
    const picked = out.picks
      .filter((i) => i >= 0 && i < capped.length)
      .map((i) => ({ start: capped[i]!.start.toISOString(), end: capped[i]!.end.toISOString() }));
    return NextResponse.json({ message: out.message, slots: picked });
  } catch {
    return NextResponse.json({
      message: "Couldn't work that out - try picking a time from the grid.",
      slots: [],
    });
  }
}
