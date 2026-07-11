import { createHash } from "node:crypto";
import {
  AppleCalendarAdapter,
  type AppleCredentials,
  type CalendarAdapter,
  type ExternalCalendar,
  GoogleCalendarAdapter,
  ICS_FEED_CALENDAR_ID,
  MicrosoftCalendarAdapter,
  type OAuthCredentials,
  fetchIcsFeed,
} from "@dayotter/calendar";
import { SsrfError, encryptJson } from "@dayotter/core";
import { getDb, schema } from "@dayotter/db";
import { enqueueSync } from "@dayotter/jobs";
import { providerConfig } from "./providers";

type Provider = "google" | "microsoft" | "apple" | "ics";

/**
 * Store a connection + its calendars and enqueue an initial sync. Shared by the
 * OAuth (Google/Microsoft) and CalDAV (Apple) connect flows. Idempotent —
 * reconnecting the same account refreshes credentials.
 */
async function persistConnection(params: {
  userId: string;
  provider: Provider;
  externalAccountId: string;
  encryptedCredentials: string;
  externalCalendars: ExternalCalendar[];
  /** Mark the created calendars read-only (ICS feeds) — never booking targets. */
  readOnly?: boolean;
}): Promise<{ connectionId: string; calendarCount: number }> {
  const db = getDb();

  const [connection] = await db
    .insert(schema.calendarConnections)
    .values({
      userId: params.userId,
      provider: params.provider,
      externalAccountId: params.externalAccountId,
      credentials: params.encryptedCredentials,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [
        schema.calendarConnections.userId,
        schema.calendarConnections.provider,
        schema.calendarConnections.externalAccountId,
      ],
      set: { credentials: params.encryptedCredentials, status: "active", lastError: null },
    })
    .returning();

  if (!connection) throw new Error("Failed to persist calendar connection");

  for (const cal of params.externalCalendars) {
    await db
      .insert(schema.calendars)
      .values({
        connectionId: connection.id,
        externalId: cal.externalId,
        name: cal.name,
        color: cal.color,
        timezone: cal.timezone,
        isTargetForBookings: params.readOnly ? false : (cal.primary ?? false),
        isReadOnly: params.readOnly ?? false,
      })
      .onConflictDoNothing({
        target: [schema.calendars.connectionId, schema.calendars.externalId],
      });
  }

  await enqueueSync({ connectionId: connection.id, reason: "initial" });
  return { connectionId: connection.id, calendarCount: params.externalCalendars.length };
}

/**
 * Persist a freshly-authorized OAuth calendar account (Google/Microsoft): encrypt
 * its tokens, store the connection + its calendars, and warm the free/busy cache.
 */
export async function connectCalendarAccount(params: {
  userId: string;
  provider: "google" | "microsoft";
  credentials: OAuthCredentials;
}): Promise<{ connectionId: string; calendarCount: number }> {
  const adapter: CalendarAdapter =
    params.provider === "google"
      ? new GoogleCalendarAdapter(providerConfig("google"), params.credentials)
      : new MicrosoftCalendarAdapter(params.credentials);

  const externalCalendars = await adapter.listCalendars();
  const primary = externalCalendars.find((c) => c.primary) ?? externalCalendars[0];

  return persistConnection({
    userId: params.userId,
    provider: params.provider,
    externalAccountId: primary?.externalId ?? `${params.provider}:${params.userId}`,
    encryptedCredentials: encryptJson(params.credentials),
    externalCalendars,
  });
}

/**
 * Connect an Apple iCloud (or other CalDAV) account via an app-specific password.
 * Unlike OAuth there's no redirect: we verify the credentials by connecting
 * immediately, and throw a friendly error if they're wrong.
 */
export async function connectAppleAccount(params: {
  userId: string;
  credentials: AppleCredentials;
}): Promise<{ connectionId: string; calendarCount: number }> {
  let adapter: AppleCalendarAdapter;
  try {
    adapter = await AppleCalendarAdapter.connect(params.credentials);
  } catch {
    throw new AppleConnectError(
      "Could not sign in. Check your Apple ID and app-specific password.",
    );
  }

  const externalCalendars = await adapter.listCalendars();
  if (externalCalendars.length === 0) {
    throw new AppleConnectError("Signed in, but no calendars were found on this account.");
  }

  return persistConnection({
    userId: params.userId,
    provider: "apple",
    externalAccountId: params.credentials.username,
    encryptedCredentials: encryptJson(params.credentials),
    externalCalendars,
  });
}

/** Thrown for user-facing Apple connect failures (bad creds, no calendars). */
export class AppleConnectError extends Error {}

/** Thrown for user-facing ICS-feed connect failures (bad URL, unreachable, not a calendar). */
export class IcsFeedError extends Error {}

/**
 * Subscribe to an external ICS / webcal feed as a read-only busy source. The
 * feed is fetched once to validate it (SSRF-guarded, must parse as iCalendar);
 * the URL — which may embed a secret token — is stored encrypted, and only a
 * hash of it is used as the account identifier. Poll-only: the maintenance tick
 * re-fetches it on the normal sync cadence.
 */
export async function connectIcsFeed(params: {
  userId: string;
  url: string;
  name?: string;
}): Promise<{ connectionId: string; calendarCount: number }> {
  const url = params.url.trim();
  let text: string;
  try {
    text = await fetchIcsFeed(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      throw new IcsFeedError("That URL isn't allowed. Use a public https or webcal feed address.");
    }
    throw new IcsFeedError("Couldn't reach that calendar feed. Check the address and try again.");
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcsFeedError("That address didn't return a calendar (ICS) feed.");
  }

  const name = params.name?.trim() || "Calendar feed";
  return persistConnection({
    userId: params.userId,
    provider: "ics",
    // Hash the URL for the account id so the (possibly secret) feed token is
    // never stored in plaintext — the real URL lives encrypted in credentials.
    externalAccountId: createHash("sha256").update(url).digest("hex"),
    encryptedCredentials: encryptJson({ url, name }),
    externalCalendars: [{ externalId: ICS_FEED_CALENDAR_ID, name }],
    readOnly: true,
  });
}
