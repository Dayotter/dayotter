import { deepWorkSuggestions } from "@/lib/booking/focus-suggestions";
import { withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Suggested deep-work blocks to protect over the next week. */
export const GET = withUser(async (u) => {
  const suggestions = await deepWorkSuggestions(u.id);
  return NextResponse.json({ suggestions });
});
