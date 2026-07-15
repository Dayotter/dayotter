import { crmJson, crmTokenRequest, splitName } from "./shared";
import {
  type CrmAccount,
  type CrmAdapter,
  CrmApiError,
  type CrmContactInput,
  type CrmCredentials,
  type CrmMeetingInput,
} from "./types";

/**
 * Salesforce CRM integration. Env-gated on SALESFORCE_CLIENT_ID/SECRET. OAuth
 * authorization-code flow; the token response carries the org's `instance_url`
 * (all REST calls target it) and a `refresh_token`. Salesforce access tokens
 * have no fixed lifetime, so we refresh reactively on a 401 and retry once.
 * Uses the REST API: Contact (find-or-create by email) + Event (the meeting).
 */

const LOGIN = "https://login.salesforce.com";
const API_VERSION = "v59.0";
const SCOPES = ["api", "refresh_token"];

function clientId(): string {
  return process.env.SALESFORCE_CLIENT_ID ?? "";
}
function clientSecret(): string {
  return process.env.SALESFORCE_CLIENT_SECRET ?? "";
}
function redirectUri(): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/integrations/crm/salesforce/callback`;
}

export function salesforceEnabled(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function salesforceAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state,
  });
  return `${LOGIN}/services/oauth2/authorize?${params.toString()}`;
}

interface SfTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  /** URL of the identity resource: .../id/{orgId}/{userId}. */
  id?: string;
  scope?: string;
}

function toCreds(t: SfTokenResponse, keepRefresh?: string): CrmCredentials {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? keepRefresh,
    instanceUrl: t.instance_url,
    scope: t.scope,
  };
}

function tokenRequest(body: Record<string, string>): Promise<SfTokenResponse> {
  return crmTokenRequest<SfTokenResponse>("salesforce", `${LOGIN}/services/oauth2/token`, body);
}

/** Exchange an authorization code for tokens + the org identity. */
export async function exchangeSalesforceCode(
  code: string,
): Promise<{ credentials: CrmCredentials; account: CrmAccount }> {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    code,
  });
  // The identity URL is .../id/{orgId}/{userId}; the org id makes a stable key.
  const orgId = token.id?.split("/").slice(-2, -1)[0];
  return {
    credentials: toCreds(token),
    account: {
      externalAccountId: orgId ?? token.instance_url,
      label: token.instance_url.replace(/^https?:\/\//, ""),
    },
  };
}

/** Escape a value for safe inclusion in a SOQL string literal. */
function soqlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Salesforce datetime is ISO-8601 with an offset; toISOString() (UTC "Z") is valid. */
function sfDate(d: Date): string {
  return d.toISOString();
}

export class SalesforceAdapter implements CrmAdapter {
  provider = "salesforce" as const;

  constructor(
    private creds: CrmCredentials,
    private persist: (next: CrmCredentials) => Promise<void>,
  ) {}

  private base(): string {
    const instance = this.creds.instanceUrl;
    if (!instance) throw new CrmApiError("salesforce", 400, "missing instance URL");
    return `${instance}/services/data/${API_VERSION}`;
  }

  private async refresh(): Promise<void> {
    if (!this.creds.refreshToken) {
      throw new CrmApiError("salesforce", 401, "access token expired and no refresh token");
    }
    const token = await tokenRequest({
      grant_type: "refresh_token",
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: this.creds.refreshToken,
    });
    this.creds = toCreds(token, this.creds.refreshToken);
    await this.persist(this.creds);
  }

  /** Fetch with a one-shot reactive refresh on 401 (expired session). */
  private async api<T>(path: string, init: RequestInit, retry = true): Promise<T> {
    try {
      return await crmJson<T>("salesforce", `${this.base()}${path}`, {
        ...init,
        token: this.creds.accessToken,
      });
    } catch (err) {
      if (retry && err instanceof CrmApiError && err.status === 401) {
        await this.refresh();
        return this.api<T>(path, init, false);
      }
      throw err;
    }
  }

  async upsertContact(input: CrmContactInput): Promise<string> {
    const q = `SELECT Id FROM Contact WHERE Email = '${soqlEscape(input.email)}' LIMIT 1`;
    const found = await this.api<{ records?: { Id: string }[] }>(
      `/query/?q=${encodeURIComponent(q)}`,
      { method: "GET" },
    );
    const existing = found.records?.[0]?.Id;
    if (existing) return existing;

    const { first, last } = splitName(input);
    const created = await this.api<{ id: string }>("/sobjects/Contact", {
      method: "POST",
      // LastName is required on Contact; fall back to the email local-part.
      body: JSON.stringify({
        FirstName: first || undefined,
        LastName: last || input.email.split("@")[0] || "Unknown",
        Email: input.email,
      }),
    });
    return created.id;
  }

  async logMeeting(input: CrmMeetingInput): Promise<string> {
    const created = await this.api<{ id: string }>("/sobjects/Event", {
      method: "POST",
      body: JSON.stringify({
        Subject: input.title,
        StartDateTime: sfDate(input.startsAt),
        EndDateTime: sfDate(input.endsAt),
        Description: input.description ?? "",
        Location: input.location ?? "",
        WhoId: input.contactExternalId,
      }),
    });
    return created.id;
  }

  async updateMeeting(externalActivityId: string, input: CrmMeetingInput): Promise<void> {
    await this.api(`/sobjects/Event/${externalActivityId}`, {
      method: "PATCH",
      body: JSON.stringify({
        StartDateTime: sfDate(input.startsAt),
        EndDateTime: sfDate(input.endsAt),
      }),
    });
  }

  async cancelMeeting(externalActivityId: string): Promise<void> {
    // Salesforce Events have no cancelled state; remove the activity.
    await this.api(`/sobjects/Event/${externalActivityId}`, { method: "DELETE" });
  }
}
