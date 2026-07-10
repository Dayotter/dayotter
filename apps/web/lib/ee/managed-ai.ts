import { isCloud } from "../billing/edition";

/**
 * Managed AI — cloud-only. calSync Cloud runs the AI features with calSync's own
 * Anthropic key so Pro customers don't configure their own. Self-hosters bring
 * their own `ANTHROPIC_API_KEY` (the AI *code* is open source; the managed key +
 * credits are the commercial part).
 */
export const managedAnthropicKey = isCloud
  ? (process.env.CALSYNC_MANAGED_ANTHROPIC_KEY ?? "")
  : "";

/** True when the cloud build has a managed key available to fall back to. */
export const cloudManagedAiAvailable = isCloud && Boolean(managedAnthropicKey);
