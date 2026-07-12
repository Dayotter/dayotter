"use client";

import { organizationClient, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Server-side, use `auth.api.*` from @dayotter/auth instead. */
export const authClient = createAuthClient({
  plugins: [organizationClient(), phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession, organization } = authClient;
