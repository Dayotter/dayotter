/**
 * The DayOtter app registry.
 *
 * Every integration - calendars, video, CRM, payments, messaging, automation -
 * is described here as an *app*: metadata, what the deployment needs configured,
 * where to connect it, and how a per-user connection is detected. The app store
 * (settings → Apps) renders straight from this list, so adding an integration is
 * one entry here plus its connect route - not another hardcoded settings page.
 *
 * Pure and dependency-free on purpose (no DB/env access at module scope) so it
 * can be unit-tested and imported from both server and client components.
 */

export const APP_CATEGORIES = [
  "calendar",
  "video",
  "crm",
  "payments",
  "messaging",
  "automation",
  "migration",
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AppCategory, string> = {
  calendar: "Calendars",
  video: "Video & conferencing",
  crm: "CRM",
  payments: "Payments",
  messaging: "Messaging & notifications",
  automation: "Automation & developer",
  migration: "Import & migration",
};

/** How to tell whether *this user* has connected the app. */
export type AppConnection =
  | { kind: "calendar"; provider: "google" | "microsoft" | "apple" | "ics" }
  | { kind: "crm"; provider: string }
  | { kind: "conferencing"; provider: string }
  | { kind: "stripe" };

export interface AppDefinition {
  id: string;
  name: string;
  category: AppCategory;
  /** One line, user-facing: what connecting it actually does. */
  blurb: string;
  /** Brand colour for the tile marker. */
  color: string;
  /**
   * Env vars the deployment must set before this app can be connected. Empty /
   * omitted = available on every deployment.
   */
  requiresEnv?: string[];
  /** Where the user goes to connect or manage it. */
  href: string;
  /** True when `href` is an API route that starts an OAuth redirect. */
  external?: boolean;
  /** Omitted for always-on capabilities that need no per-user connection. */
  connection?: AppConnection;
  /** Always on - no connection step (shown as "Included"). */
  builtIn?: boolean;
}

export const APPS: AppDefinition[] = [
  // ---- Calendars ----
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    blurb: "Two-way sync: read busy times and write your bookings back.",
    color: "#4285F4",
    requiresEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    href: "/api/calendars/connect/google",
    external: true,
    connection: { kind: "calendar", provider: "google" },
  },
  {
    id: "microsoft-outlook",
    name: "Outlook / Microsoft 365",
    category: "calendar",
    blurb: "Two-way sync with Outlook and Microsoft 365 calendars.",
    color: "#0078D4",
    requiresEnv: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    href: "/api/calendars/connect/microsoft",
    external: true,
    connection: { kind: "calendar", provider: "microsoft" },
  },
  {
    id: "apple-caldav",
    name: "Apple iCloud & CalDAV",
    category: "calendar",
    blurb: "iCloud, Fastmail, Mailbox.org and other CalDAV servers.",
    color: "#111111",
    href: "/settings/calendars",
    connection: { kind: "calendar", provider: "apple" },
  },
  {
    id: "ics-feed",
    name: "ICS / webcal feed",
    category: "calendar",
    blurb: "Subscribe to a read-only calendar feed so it blocks your availability.",
    color: "#6B7280",
    href: "/settings/calendars",
    connection: { kind: "calendar", provider: "ics" },
  },

  // ---- Video ----
  {
    id: "zoom",
    name: "Zoom",
    category: "video",
    blurb: "Auto-create a Zoom meeting for every booking on a Zoom event type.",
    color: "#2D8CFF",
    requiresEnv: ["ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
    href: "/api/integrations/zoom/connect",
    external: true,
    connection: { kind: "conferencing", provider: "zoom" },
  },
  {
    id: "google-meet",
    name: "Google Meet",
    category: "video",
    blurb: "Meet links are generated on the calendar invite - no extra setup.",
    color: "#00897B",
    href: "/settings/calendars",
    builtIn: true,
  },
  {
    id: "ms-teams",
    name: "Microsoft Teams",
    category: "video",
    blurb: "Teams links are generated on the calendar invite - no extra setup.",
    color: "#6264A7",
    href: "/settings/calendars",
    builtIn: true,
  },

  // ---- CRM ----
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    blurb: "Log every booking as an Event on the matched Contact.",
    color: "#00A1E0",
    requiresEnv: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
    href: "/api/integrations/crm/salesforce",
    external: true,
    connection: { kind: "crm", provider: "salesforce" },
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    blurb: "Create the contact and log the meeting, kept in sync on reschedule.",
    color: "#FF7A59",
    requiresEnv: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
    href: "/api/integrations/crm/hubspot",
    external: true,
    connection: { kind: "crm", provider: "hubspot" },
  },

  // ---- Payments ----
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    blurb: "Charge for bookings and get paid out via Stripe Connect.",
    color: "#635BFF",
    requiresEnv: ["STRIPE_SECRET_KEY"],
    href: "/settings/payouts",
    connection: { kind: "stripe" },
  },

  // ---- Messaging ----
  {
    id: "twilio-sms",
    name: "SMS (Twilio)",
    category: "messaging",
    blurb: "Text reminders and booking notifications.",
    color: "#F22F46",
    requiresEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"],
    href: "/settings/notifications",
  },
  {
    id: "twilio-whatsapp",
    name: "WhatsApp (Twilio)",
    category: "messaging",
    blurb: "WhatsApp reminders, plus inbound messages to Otter.",
    color: "#25D366",
    requiresEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"],
    href: "/settings/notifications",
  },
  {
    id: "slack",
    name: "Slack",
    category: "messaging",
    blurb: "Post reminders and daily briefings to a Slack channel.",
    color: "#611F69",
    href: "/settings/notifications",
  },
  {
    id: "web-push",
    name: "Browser push",
    category: "messaging",
    blurb: "Push reminders to your browser, no app required.",
    color: "#8B5CF6",
    requiresEnv: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
    href: "/settings/notifications",
  },

  // ---- Automation & developer ----
  {
    id: "webhooks",
    name: "Webhooks",
    category: "automation",
    blurb: "Fire booking events at your own endpoints, with delivery history.",
    color: "#0EA5E9",
    href: "/settings/developer",
    builtIn: true,
  },
  {
    id: "api-keys",
    name: "REST API",
    category: "automation",
    blurb: "API keys for the public v1 API.",
    color: "#10B981",
    href: "/settings/developer",
    builtIn: true,
  },
  {
    id: "plugins",
    name: "Plugins",
    category: "automation",
    blurb: "Extend DayOtter in-process with trusted plugins (DAYOTTER_PLUGINS).",
    color: "#F59E0B",
    href: "/settings/developer",
    builtIn: true,
  },

  // ---- Migration ----
  {
    id: "calendly-import",
    name: "Calendly import",
    category: "migration",
    blurb: "Bring your Calendly event types and weekly availability across.",
    color: "#006BFF",
    href: "/settings/import",
    builtIn: true,
  },
];

/** True when the deployment has every env var this app needs. */
export function isConfigured(
  app: AppDefinition,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (app.requiresEnv ?? []).every((k) => Boolean(env[k]));
}

/** The user's connections, as provider sets - what `isConnected` matches against. */
export interface ConnectionState {
  calendars: Set<string>;
  crm: Set<string>;
  conferencing: Set<string>;
  stripe: boolean;
}

/** True when this user has connected the app. Built-ins are never "connected"
 *  (they're always on); apps with no connection step return false. */
export function isConnected(app: AppDefinition, state: ConnectionState): boolean {
  const c = app.connection;
  if (!c) return false;
  switch (c.kind) {
    case "calendar":
      return state.calendars.has(c.provider);
    case "crm":
      return state.crm.has(c.provider);
    case "conferencing":
      return state.conferencing.has(c.provider);
    case "stripe":
      return state.stripe;
  }
}

/** Apps grouped by category, preserving registry order and skipping empties. */
export function appsByCategory(
  apps: AppDefinition[] = APPS,
): { category: AppCategory; label: string; apps: AppDefinition[] }[] {
  return APP_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    apps: apps.filter((a) => a.category === category),
  })).filter((g) => g.apps.length > 0);
}

/** Case-insensitive search over name + blurb, for the app-store filter box. */
export function searchApps(query: string, apps: AppDefinition[] = APPS): AppDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return apps;
  return apps.filter((a) => a.name.toLowerCase().includes(q) || a.blurb.toLowerCase().includes(q));
}
