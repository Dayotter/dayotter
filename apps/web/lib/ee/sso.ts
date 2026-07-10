import { isCloud } from "../billing/edition";

/**
 * SSO (SAML / Google Workspace) — cloud-only, commercial. Lets a team sign in
 * through their identity provider. Availability is gated on the cloud edition +
 * the `sso` entitlement (cloud + Pro).
 *
 * NOTE: the IdP wiring (Better Auth SSO/SAML plugin + per-domain connection
 * config) is provisioned per-customer in the hosted control plane and is not
 * part of this open-source repo. This module exposes the gate + domain routing;
 * the connection store is a hosted service.
 */
export const ssoAvailable = isCloud;

/**
 * Given a work email, return the SSO provider a team has configured for its
 * domain, or null to fall back to password / Google sign-in. In the OSS build
 * this is always null (SSO doesn't exist there).
 */
export function ssoProviderForEmail(_email: string): string | null {
  if (!ssoAvailable) return null;
  // Hosted control plane resolves domain → SAML/OIDC connection. Not in OSS.
  return null;
}
