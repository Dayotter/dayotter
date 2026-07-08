import type { ProviderOAuthConfig } from "@calsync/calendar";
import { env } from "../server/env";

/** OAuth app config per provider, from env. Redirect URIs must match the connect routes. */
export function providerConfig(provider: "google" | "microsoft"): ProviderOAuthConfig {
  if (provider === "google") {
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.APP_URL}/api/calendars/connect/google/callback`,
    };
  }
  return {
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    redirectUri: `${env.APP_URL}/api/calendars/connect/microsoft/callback`,
  };
}
