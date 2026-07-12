import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { getServerUrl } from "./server";

/**
 * Better Auth client wired with the Expo plugin — used ONLY for native OAuth
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
    plugins: [expoClient({ scheme: "dayotter", storagePrefix: "dayotter", storage: SecureStore })],
  });
}

type Client = ReturnType<typeof makeClient>;
let cached: { url: string; client: Client } | null = null;

export function getAuthClient(): Client {
  const url = getServerUrl();
  if (!cached || cached.url !== url) cached = { url, client: makeClient(url) };
  return cached.client;
}

/** Whether the "Continue with Google" button should render. */
export const googleAuthEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH === "1";
