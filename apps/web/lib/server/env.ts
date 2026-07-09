import { z } from "zod";

/**
 * Validated, typed environment access for the web app. Parsed once at import.
 * Optional vars (OAuth creds, SMTP) default to empty so `next build` — which
 * evaluates modules without a full env — never throws; presence is checked at
 * the point of use instead. Security-critical secrets get a hard strength check
 * at runtime in production (see `assertSecrets` below).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  MICROSOFT_CLIENT_ID: z.string().default(""),
  MICROSOFT_CLIENT_SECRET: z.string().default(""),
  ZOOM_CLIENT_ID: z.string().default(""),
  ZOOM_CLIENT_SECRET: z.string().default(""),

  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("calSync <no-reply@example.com>"),

  // Optional Cloudflare Turnstile captcha on the public booking form.
  TURNSTILE_SECRET: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),

  // Optional analytics — nothing loads unless set.
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),

  // Optional AI scheduling (Claude). AI features are hidden unless set.
  ANTHROPIC_API_KEY: z.string().optional(),

  // Optional Stripe payments — paid bookings are disabled unless set.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

/** The auth signing secret, from either env name. */
export const authSecret = () => env.AUTH_SECRET ?? env.BETTER_AUTH_SECRET;

/** Known placeholders shipped in .env.example that must never reach production. */
const PLACEHOLDER_SECRETS = new Set(["change-me-in-production", ""]);
const ALL_ZERO_KEY = /^0+$/;

/**
 * Fail fast if production is running with missing or placeholder secrets. Skipped
 * during `next build` (no runtime env yet) — enforced on the server at first use.
 */
export function assertSecrets(): void {
  if (env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const problems: string[] = [];
  const secret = authSecret();
  if (!secret || secret.length < 32 || PLACEHOLDER_SECRETS.has(secret)) {
    problems.push("AUTH_SECRET/BETTER_AUTH_SECRET must be a random string of 32+ chars");
  }
  const key = env.ENCRYPTION_KEY ?? "";
  if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key) || ALL_ZERO_KEY.test(key)) {
    problems.push("ENCRYPTION_KEY must be a random 64-hex-char (32-byte) value, not the placeholder");
  }
  if (env.APP_URL.startsWith("http://")) {
    problems.push("APP_URL must be https in production");
  }
  if (problems.length > 0) {
    throw new Error(`Insecure production configuration:\n - ${problems.join("\n - ")}`);
  }
}

// Fail fast at server startup (no-op during build / outside production).
assertSecrets();
