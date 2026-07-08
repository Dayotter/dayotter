import { cancelBooking } from "@/lib/booking/cancel-booking";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const body = await request.json().catch(() => ({}));
  const ok = await cancelBooking(uid, typeof body?.reason === "string" ? body.reason : undefined);
  if (!ok) {
    return NextResponse.json({ error: "Booking not found or already cancelled" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
