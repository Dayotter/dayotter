import { getDb, schema } from "@calsync/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { bearer, organization } from "better-auth/plugins";

/**
 * Better Auth server instance — the single source of truth for identity and
 * organizations. Lives in a package (not apps/web) so the future mobile API
 * uses the exact same auth. See docs/DECISIONS.md §2 (API-first).
 *
 * The Drizzle adapter maps Better Auth's model names to our tables; note
 * `member -> memberships`. IDs are DB-generated UUIDs (`generateId: false`),
 * so Better Auth defers id creation to Postgres `defaultRandom()`.
 */
export const auth = betterAuth({
  appName: "calSync",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      organization: schema.organizations,
      member: schema.memberships,
      invitation: schema.invitations,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      handle: { type: "string", required: false, input: true },
      timezone: { type: "string", required: false, input: true },
    },
  },
  advanced: {
    database: {
      // Let Postgres generate UUIDs via defaultRandom() instead of Better Auth.
      generateId: false,
    },
  },
  // `bearer` enables token auth for native mobile clients; `nextCookies` must be
  // last so cookies are set correctly from server actions.
  plugins: [organization(), bearer(), nextCookies()],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
