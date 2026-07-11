import { isCloud } from "../billing/edition";
import { hasFeature } from "../billing/features";

/**
 * White-label — cloud-only, commercial. Pro customers on cloud can remove the
 * "Powered by DayOtter" mark and serve booking pages on their own domain.
 */

/** Should the "Powered by DayOtter" mark be HIDDEN on this org's public pages? */
export function brandingHidden(ctx: { isPro: boolean }): boolean {
  // Only cloud + Pro (white_label is a cloud-tier feature) may remove branding.
  return hasFeature("white_label", { isCloud, isPro: ctx.isPro });
}

/** Whether the org may map a custom booking domain (CNAME). Cloud + Pro only. */
export function customDomainAvailable(ctx: { isPro: boolean }): boolean {
  return hasFeature("white_label", { isCloud, isPro: ctx.isPro });
  // NOTE: actual CNAME verification + TLS issuance runs in the hosted edge, not OSS.
}
