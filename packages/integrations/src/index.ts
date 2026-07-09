import {
  AppleCalendarAdapter,
  type AppleCredentials,
  type CalendarAdapter,
  GoogleCalendarAdapter,
  IcsFeedAdapter,
  MicrosoftCalendarAdapter,
  type OAuthCredentials,
  type ProviderOAuthConfig,
} from "@calsync/calendar";
import { decryptJson, encryptJson } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";

type ConnectionRow = typeof schema.calendarConnections.$inferSelect;

function oauthConfig(provider: "google" | "microsoft"): ProviderOAuthConfig {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] ?? "",
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] ?? "",
    redirectUri: `${appUrl}/api/calendars/connect/${provider}/callback`,
  };
}

async function persistCredentials(connectionId: string, creds: OAuthCredentials): Promise<void> {
  await getDb()
    .update(schema.calendarConnections)
    .set({ credentials: encryptJson(creds) })
    .where(eq(schema.calendarConnections.id, connectionId));
}

/**
 * Build a live provider adapter from a stored, encrypted connection — the single
 * source of truth shared by the sync worker and the web booking flow. Decrypts
 * credentials, refreshes tokens when needed, and persists rotations.
 */
export async function adapterForConnection(connection: ConnectionRow): Promise<CalendarAdapter> {
  switch (connection.provider) {
    case "google": {
      const creds = decryptJson<OAuthCredentials>(connection.credentials);
      return new GoogleCalendarAdapter(oauthConfig("google"), creds, (next) =>
        persistCredentials(connection.id, next),
      );
    }
    case "microsoft": {
      const creds = decryptJson<OAuthCredentials>(connection.credentials);
      // Proactively refresh if the access token has expired.
      if (creds.expiresAt && creds.expiresAt < Date.now() && creds.refreshToken) {
        const next = await MicrosoftCalendarAdapter.refresh(
          oauthConfig("microsoft"),
          creds.refreshToken,
        );
        await persistCredentials(connection.id, next);
        return new MicrosoftCalendarAdapter(next);
      }
      return new MicrosoftCalendarAdapter(creds);
    }
    case "apple":
      return AppleCalendarAdapter.connect(decryptJson<AppleCredentials>(connection.credentials));
    case "ics": {
      const feed = decryptJson<{ url: string; name?: string }>(connection.credentials);
      return new IcsFeedAdapter(feed.url, feed.name);
    }
    default:
      throw new Error(`Unsupported provider: ${connection.provider}`);
  }
}
