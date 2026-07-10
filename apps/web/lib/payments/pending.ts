import { randomUUID } from "node:crypto";
import { connection } from "@calsync/jobs";
import type { CreateBookingInput } from "../booking/create-booking";

const PREFIX = "calsync:pendingbooking:";
const TTL_SECONDS = 3600; // a checkout session lives ~1h

/** Stash the intended booking while the booker completes Stripe Checkout. */
export async function stashPendingBooking(input: CreateBookingInput): Promise<string> {
  const token = randomUUID();
  await connection.set(`${PREFIX}${token}`, JSON.stringify(input), "EX", TTL_SECONDS);
  return token;
}

/** Atomically claim (GET + DEL) the stashed booking — one-time use so the success
 *  handler and the webhook can't both create it. */
export async function claimPendingBooking(token: string): Promise<CreateBookingInput | null> {
  const raw = await connection.getdel(`${PREFIX}${token}`);
  return raw ? (JSON.parse(raw) as CreateBookingInput) : null;
}
