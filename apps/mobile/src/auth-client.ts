import { expoClient } from "@better-auth/expo/client";
import { phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { getServerUrl } from "./server";

/**
 * Better Auth client wired with the Expo plugin - used ONLY for native OAuth
 * (Google sign-in), which needs the deep-link/browser bridge. Email/password
 * uses the lightweight bearer flow in api.ts/auth.tsx.
 *
 * The client's baseURL is fixed at creation, so we rebuild it whenever the
 * selected server changes ("bring your own server"). Always reach it through
 * getAuthClient() rather than caching the instance.
 */
// Factory so the inferred type keeps the expoClient plugin methods (e.g. getCookie).
function makeClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      expoClient({ scheme: "dayotter", storagePrefix: "dayotter", storage: SecureStore }),
      phoneNumberClient(),
    ],
  });
}

type Client = ReturnType<typeof makeClient>;
let cached: { url: string; client: Client } | null = null;

export function getAuthClient(): Client {
  const url = getServerUrl();
  if (!cached || cached.url !== url) cached = { url, client: makeClient(url) };
  return cached.client;
}

/**
 * Hard-clear the Better Auth Expo session. The client's own `signOut()` is
 * best-effort (a network blip leaves the stored cookie behind), and it caches
 * the cookie in memory - so on sign-out we also delete its SecureStore keys AND
 * drop the cached client, or the previous account's session leaks into the next
 * sign-in (e.g. logging out of X then into Y still shows X). Key names come from
 * @better-auth/expo: `${storagePrefix}_cookie` and `${storagePrefix}_session_data`.
 */
export async function clearBetterAuthSession(): Promise<void> {
  cached = null; // force a fresh client (drops any in-memory cookie) next call
  await Promise.all([
    SecureStore.deleteItemAsync("dayotter_cookie").catch(() => {}),
    SecureStore.deleteItemAsync("dayotter_session_data").catch(() => {}),
  ]);
}

/** Whether the "Continue with Google" button should render. */
export const googleAuthEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH === "1";

/** Whether phone + OTP sign-in should render (operator runs Twilio on the server). */
export const phoneAuthEnabled = process.env.EXPO_PUBLIC_PHONE_AUTH === "1";
