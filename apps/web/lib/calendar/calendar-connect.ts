import {
  AppleCalendarAdapter,
  type AppleCredentials,
  type CalendarAdapter,
  type ExternalCalendar,
  GoogleCalendarAdapter,
  MicrosoftCalendarAdapter,
  type OAuthCredentials,
} from "@calsync/calendar";
import { encryptJson } from "@calsync/core";
import { getDb, schema } from "@calsync/db";
import { enqueueSync } from "@calsync/jobs";
import { providerConfig } from "./providers";

type Provider = "google" | "microsoft" | "apple";

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
        isTargetForBookings: cal.primary ?? false,
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
