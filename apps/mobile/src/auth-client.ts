import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { BASE_URL } from "./config";

/**
 * Better Auth client wired with the Expo plugin — used ONLY for native OAuth
 * (Google sign-in), which needs the deep-link/browser bridge. Email/password
 * still uses the lightweight bearer flow in api.ts/auth.tsx. After a social
 * sign-in we mint a bearer token (GET /api/auth/token) and hand it to api.ts so
 * every other request stays on the one auth mechanism.
 */
export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [
    expoClient({
      scheme: "calsync",
      storagePrefix: "calsync",
      storage: SecureStore,
    }),
  ],
});

/** Whether the "Continue with Google" button should render. */
export const googleAuthEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH === "1";
