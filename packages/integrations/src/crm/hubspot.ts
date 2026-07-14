import {
  type CrmAccount,
  type CrmAdapter,
  CrmApiError,
  type CrmContactInput,
  type CrmCredentials,
  type CrmMeetingInput,
} from "./types";

/**
 * HubSpot CRM integration. Env-gated on HUBSPOT_CLIENT_ID/SECRET. Tokens are
 * OAuth (authorization-code), stored encrypted per connection. Uses the CRM v3
 * objects API for contacts + meetings. HubSpot datetime properties are epoch ms.
 */

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const API = "https://api.hubapi.com";

// Scopes: read/write CRM objects (contacts) and schedule/meetings.
const SCOPES = ["crm.objects.contacts.read", "crm.objects.contacts.write"];

// Meeting → Contact default association (HUBSPOT_DEFINED).
const MEETING_TO_CONTACT_TYPE_ID = 200;

function clientId(): string {
  return process.env.HUBSPOT_CLIENT_ID ?? "";
}
function clientSecret(): string {
  return process.env.HUBSPOT_CLIENT_SECRET ?? "";
}
function redirectUri(): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/integrations/crm/hubspot/callback`;
}

export function hubspotEnabled(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function hubspotAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function toCreds(token: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): CrmCredentials {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    // Refresh a minute early to avoid edge-of-expiry failures.
    expiresAt: Date.now() + (token.expires_in - 60) * 1000,
  };
}

async function tokenRequest(body: Record<string, string>): Promise<CrmCredentials> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    throw new CrmApiError("hubspot", res.status, `token exchange failed: ${await res.text()}`);
  }
  return toCreds(
    (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number },
  );
}

/** Exchange an authorization code for tokens + the connected portal identity. */
export async function exchangeHubspotCode(
  code: string,
): Promise<{ credentials: CrmCredentials; account: CrmAccount }> {
  const credentials = await tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    code,
  });
  const info = await fetch(`${API}/oauth/v1/access-tokens/${credentials.accessToken}`);
  let account: CrmAccount = { externalAccountId: "hubspot", label: null };
  if (info.ok) {
    const data = (await info.json()) as { hub_id?: number; hub_domain?: string };
    account = {
      externalAccountId: data.hub_id ? String(data.hub_id) : "hubspot",
      label: data.hub_domain ?? null,
    };
  }
  return { credentials, account };
}

export class HubspotAdapter implements CrmAdapter {
  provider = "hubspot" as const;

  constructor(
    private creds: CrmCredentials,
    private persist: (next: CrmCredentials) => Promise<void>,
  ) {}

  private async token(): Promise<string> {
    if (this.creds.expiresAt && this.creds.expiresAt < Date.now() && this.creds.refreshToken) {
      this.creds = await tokenRequest({
        grant_type: "refresh_token",
        client_id: clientId(),
        client_secret: clientSecret(),
        refresh_token: this.creds.refreshToken,
      });
      await this.persist(this.creds);
    }
    return this.creds.accessToken;
  }

  private async api<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.token()}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new CrmApiError("hubspot", res.status, await res.text());
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  async upsertContact(input: CrmContactInput): Promise<string> {
    // Find by email first so we never create a duplicate.
    const search = await this.api<{ results?: { id: string }[] }>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [
            { filters: [{ propertyName: "email", operator: "EQ", value: input.email }] },
          ],
          properties: ["email"],
          limit: 1,
        }),
      },
    );
    const existing = search.results?.[0]?.id;
    if (existing) return existing;

    const { first, last } = splitName(input);
    const created = await this.api<{ id: string }>("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({
        properties: { email: input.email, firstname: first, lastname: last },
      }),
    });
    return created.id;
  }

  async logMeeting(input: CrmMeetingInput): Promise<string> {
    const created = await this.api<{ id: string }>("/crm/v3/objects/meetings", {
      method: "POST",
      body: JSON.stringify({
        properties: meetingProps(input, "SCHEDULED"),
        associations: [
          {
            to: { id: input.contactExternalId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: MEETING_TO_CONTACT_TYPE_ID,
              },
            ],
          },
        ],
      }),
    });
    return created.id;
  }

  async updateMeeting(externalActivityId: string, input: CrmMeetingInput): Promise<void> {
    await this.api(`/crm/v3/objects/meetings/${externalActivityId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: meetingProps(input, "RESCHEDULED") }),
    });
  }

  async cancelMeeting(externalActivityId: string): Promise<void> {
    await this.api(`/crm/v3/objects/meetings/${externalActivityId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: { hs_meeting_outcome: "CANCELED" } }),
    });
  }
}

function meetingProps(input: CrmMeetingInput, _outcome: string): Record<string, string> {
  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();
  return {
    hs_timestamp: String(start),
    hs_meeting_title: input.title,
    hs_meeting_body: input.description ?? "",
    hs_meeting_location: input.location ?? "",
    hs_meeting_start_time: String(start),
    hs_meeting_end_time: String(end),
  };
}

function splitName(input: CrmContactInput): { first: string; last: string } {
  if (input.firstName || input.lastName) {
    return { first: input.firstName ?? "", last: input.lastName ?? "" };
  }
  const parts = (input.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}
