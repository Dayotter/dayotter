import { safeFetch } from "@dayotter/core";
import { CrmApiError, type CrmContactInput, type CrmProvider } from "./types";

/**
 * Split a contact's name into first/last, consistently across providers. A lone
 * token is treated as a FIRST name (the natural reading) - previously Salesforce
 * and HubSpot disagreed on this, silently landing a one-word name in different
 * fields. Adapters that require a last name (Salesforce) apply their own fallback
 * for the empty `last`.
 */
export function splitName(input: CrmContactInput): { first: string; last: string } {
  if (input.firstName || input.lastName) {
    return { first: input.firstName ?? "", last: input.lastName ?? "" };
  }
  const parts = (input.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/** POST a form-encoded OAuth token request; throws CrmApiError on a non-2xx.
 *  Uses the SSRF-safe fetch (HTTPS-only, IP-pinned) since the endpoint is
 *  provider-configured. */
export async function crmTokenRequest<T>(
  provider: CrmProvider,
  url: string,
  body: Record<string, string>,
): Promise<T> {
  const res = await safeFetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    throw new CrmApiError(provider, res.status, `token exchange failed: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Bearer-authenticated JSON request; 204 → undefined; throws CrmApiError on
 *  non-2xx. Routed through safeFetch because Salesforce's REST base comes from
 *  the token's `instance_url` (not a value we fully control). */
export async function crmJson<T>(
  provider: CrmProvider,
  url: string,
  init: RequestInit & { token: string },
): Promise<T> {
  const { token, headers, method, body } = init;
  const res = await safeFetch(url, {
    method: method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...((headers as Record<string, string> | undefined) ?? {}),
    },
    // safeFetch takes a string body; CRM adapters always pass JSON strings.
    ...(typeof body === "string" ? { body } : {}),
  });
  if (!res.ok) throw new CrmApiError(provider, res.status, await res.text());
  return (res.status === 204 ? undefined : await res.json()) as T;
}
