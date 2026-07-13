import { RoutingError, submitAndRoute } from "@/lib/routing/routing";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  answers: z.record(z.string().max(400)),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = await enforceRateLimit(request, {
    name: "routing-submit",
    limit: 30,
    windowSec: 600,
  });
  if (limited) return limited;

  const { token } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });

  try {
    const { url } = await submitAndRoute(token, parsed.data.answers);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof RoutingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
