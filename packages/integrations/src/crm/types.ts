/**
 * Native CRM sync - the provider-agnostic contract. Salesforce and HubSpot
 * adapters implement `CrmAdapter`; the sync worker and web OAuth flow only ever
 * see this interface, so adding a CRM never leaks upward (same design as the
 * calendar `CalendarAdapter`).
 */

export type CrmProvider = "salesforce" | "hubspot";

export const CRM_PROVIDERS: CrmProvider[] = ["salesforce", "hubspot"];

/** OAuth tokens + provider endpoint, stored encrypted per connection. */
export interface CrmCredentials {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires (0/undefined = unknown). */
  expiresAt?: number;
  /** Salesforce: the org's instance URL (e.g. https://acme.my.salesforce.com). */
  instanceUrl?: string;
  scope?: string;
}

/** The account identity captured at connect time, for display + de-dupe. */
export interface CrmAccount {
  externalAccountId: string;
  label: string | null;
}

export interface CrmContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  /** Full name fallback when first/last aren't split. */
  name?: string;
}

export interface CrmMeetingInput {
  title: string;
  startsAt: Date;
  endsAt: Date;
  description?: string;
  location?: string;
  /** The external contact id the meeting is associated with. */
  contactExternalId: string;
}

/**
 * A live CRM connection. `persistCredentials` is called after a token refresh so
 * the rotated tokens are saved (mirrors the calendar adapter contract).
 */
export interface CrmAdapter {
  provider: CrmProvider;
  /** Find-or-create a contact by email; returns its external id. */
  upsertContact(input: CrmContactInput): Promise<string>;
  /** Log a meeting/activity associated with the contact; returns its external id. */
  logMeeting(input: CrmMeetingInput): Promise<string>;
  /** Update a previously logged meeting (used on reschedule). */
  updateMeeting(externalActivityId: string, input: CrmMeetingInput): Promise<void>;
  /** Mark a logged meeting cancelled (close it / delete it). */
  cancelMeeting(externalActivityId: string): Promise<void>;
}

/** Thrown by adapters on a non-2xx provider response, with context. */
export class CrmApiError extends Error {
  constructor(
    public provider: CrmProvider,
    public status: number,
    message: string,
  ) {
    super(`[${provider}] ${status}: ${message}`);
    this.name = "CrmApiError";
  }
}
