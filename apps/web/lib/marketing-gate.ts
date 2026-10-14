/**
 * Instances that only host the app (no public product site) set
 * DAYOTTER_MARKETING=off. The marketing pages then bounce to the app, which
 * itself sends signed-out visitors to /sign-in.
 *
 * Privacy and terms stay up: the auth screens link to them.
 */
const MARKETING_PREFIXES = [
  "/about",
  "/blog",
  "/changelog",
  "/contact",
  "/docs",
  "/features",
  "/for",
  "/glossary",
  "/integrations",
  "/pricing",
  "/security",
  "/self-hosting",
  "/status",
  "/vs",
];

/** Where to send `pathname` instead, or null to serve it as usual. */
export function marketingRedirect(pathname: string, setting: string | undefined): string | null {
  if (setting !== "off") return null;
  if (pathname === "/") return "/dashboard";
  const isMarketing = MARKETING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return isMarketing ? "/dashboard" : null;
}
