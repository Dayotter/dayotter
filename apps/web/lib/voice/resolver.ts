import { eq, getDb, schema } from "@dayotter/db";
import type { VoiceHost } from "./knowledge";

/**
 * Resolve which host a call to `toNumber` should be answered for.
 *
 * MVP: single-tenant via the VOICE_RECEPTIONIST_HANDLE env (the handle of the
 * host this line answers for). Extension point for multi-tenant: replace this
 * with a `voice_numbers` table mapping each Twilio number → host, and look up
 * by `toNumber`.
 */
export async function resolveVoiceHost(_toNumber: string): Promise<VoiceHost | null> {
  const handle = process.env.VOICE_RECEPTIONIST_HANDLE;
  if (!handle) return null;
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.handle, handle),
    columns: { id: true, name: true, handle: true, timezone: true },
  });
  if (!user) return null;
  const appUrl = process.env.APP_URL ?? "https://dayotter.com";
  return {
    userId: user.id,
    name: user.name ?? "our team",
    handle: user.handle,
    timezone: user.timezone,
    bookingUrl: user.handle ? `${appUrl}/${user.handle}` : null,
  };
}
