import { PollError, submitVotes } from "@/lib/polls/polls";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  responses: z
    .array(
      z.object({
        optionId: z.string().uuid(),
        response: z.enum(["yes", "no", "maybe"]),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await enforceRateLimit(request, { name: "poll-vote", limit: 20, windowSec: 600 });
  if (limited) return limited;

  const { token } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid vote" }, { status: 400 });

  try {
    await submitVotes(
      token,
      { name: parsed.data.name, email: parsed.data.email },
      parsed.data.responses,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PollError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
