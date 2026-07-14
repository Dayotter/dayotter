/**
 * DayOtter Cloud (commercial) edition features. See ./LICENSE.md - this module is
 * NOT covered by the repo's open-source license.
 *
 * Everything here is hard-gated on `isCloud`: in the open-source self-hosted
 * build these functions are inert (return "off"/null), so the OSS product is
 * fully functional without them. Each capability additionally requires the
 * relevant plan entitlement (`managed_ai`, `sso`, `white_label`,
 * `hosted_messaging` are all `cloud`-tier → cloud + Pro).
 */
export { managedAnthropicKey, cloudManagedAiAvailable } from "./managed-ai";
export { hostedMessagingAvailable, hostedTwilioCreds } from "./messaging";
export { ssoAvailable, ssoProviderForEmail } from "./sso";
export { brandingHidden, customDomainAvailable } from "./white-label";
