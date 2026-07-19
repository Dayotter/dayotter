import { PollError, createPoll, listPolls } from "@/lib/polls/polls";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The host's polls with lightweight option/vote rows (mobile Polls list). */
export const GET = withUser(async (u) => {
  return NextResponse.json({ polls: await listPolls(u.id) });
});

const bodySchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(1440),
  location: z.string().max(200).optional(),
  times: z.array(z.string().datetime()).min(2).max(20),
});

export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid poll", 400);
  try {
    const { token, id } = await createPoll(u.id, parsed.data);
    return NextResponse.json({ token, id, url: `/polls/${id}` });
  } catch (err) {
    if (err instanceof PollError) return jsonError(err.message, err.status);
    throw err;
  }
});
