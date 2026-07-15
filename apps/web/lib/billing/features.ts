/**
 * The feature catalog + the open-core entitlement policy. One place decides who
 * gets what, so gating never drifts across routes/UI.
 *
 * Tiers:
 * - `free`  - always available (core scheduling). Never gated.
 * - `pro`   - the differentiators. FREE on self-host; on cloud requires the
 *             $9/seat Pro plan.
 * - `cloud` - commercial `ee/` features that only exist in the hosted build
 *             (absent from the open-source repo); require cloud + Pro.
 */
export type FeatureTier = "free" | "pro" | "cloud";

export type Feature =
  // Pro differentiators (self-host free; cloud paywalled)
  | "ai" // AI scheduling, NL command, intelligence recommendations
  | "automation" // automation rules + weekly blocks
  | "workflows" // automated attendee messaging (reminders / follow-ups)
  | "analytics" // funnel / conversion / CSV
  | "sms_reminders" // SMS reminders only (carrier cost); Slack/WhatsApp are free
  | "adaptive" // adaptive availability
  | "travel" // travel-aware scheduling
  | "deep_work" // focus-time defense
  | "accept_payments" // charge attendees for bookings
  | "developer" // API keys, webhooks, embed
  | "crm_sync" // native Salesforce / HubSpot sync
  // Cloud-only (ee/, commercial license)
  | "managed_ai" // AI with DayOtter's key - no BYO key
  | "sso" // SAML / Google Workspace sign-in
  | "white_label" // remove branding + custom booking domain
  | "hosted_messaging"; // SMS/WhatsApp via DayOtter's Twilio credits

export const FEATURE_TIER: Record<Feature, FeatureTier> = {
  // Otter (AI scheduling + NL command + the assistant chat) is a core USP - free
  // for everyone, on cloud too. Cloud simply uses DayOtter's managed key (see
  // managed_ai / lib/ee) so free users need no BYO key.
  ai: "free",
  automation: "pro",
  workflows: "pro",
  analytics: "pro",
  // Slack + WhatsApp reminders are free; only SMS (real carrier cost) is Pro.
  sms_reminders: "pro",
  adaptive: "pro",
  travel: "pro",
  deep_work: "free",
  accept_payments: "pro",
  developer: "free",
  crm_sync: "free",
  managed_ai: "cloud",
  sso: "cloud",
  white_label: "cloud",
  hosted_messaging: "cloud",
};

export const ALL_FEATURES = Object.keys(FEATURE_TIER) as Feature[];

/** Human labels for upgrade prompts. */
export const FEATURE_LABEL: Record<Feature, string> = {
  ai: "AI scheduling",
  automation: "Automations",
  workflows: "Workflows",
  analytics: "Analytics",
  sms_reminders: "SMS reminders",
  adaptive: "Adaptive availability",
  travel: "Travel-aware scheduling",
  deep_work: "Deep-work defense",
  accept_payments: "Accept payments",
  developer: "Developer platform",
  crm_sync: "CRM sync (Salesforce / HubSpot)",
  managed_ai: "Managed AI",
  sso: "Single sign-on",
  white_label: "White-label booking",
  hosted_messaging: "Hosted messaging",
};

export interface EntitlementContext {
  /** Is this the hosted (cloud) build? */
  isCloud: boolean;
  /** Does the org hold an active Pro plan? (meaningful only on cloud) */
  isPro: boolean;
}

/** The single source of truth for "can this account use `feature`?". */
export function hasFeature(feature: Feature, ctx: EntitlementContext): boolean {
  const tier = FEATURE_TIER[feature];
  if (tier === "free") return true;
  if (tier === "cloud") return ctx.isCloud && ctx.isPro; // ee/ + Pro
  // "pro": free on self-host, paid on cloud.
  return ctx.isCloud ? ctx.isPro : true;
}
