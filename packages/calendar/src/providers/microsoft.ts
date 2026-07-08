import { Client } from "@microsoft/microsoft-graph-client";
import type {
  BusyEvent,
  BusyInterval,
  CalendarAdapter,
  CreatedEvent,
  ExternalCalendar,
  NewCalendarEvent,
  OAuthCredentials,
  ProviderOAuthConfig,
  SyncResult,
  WatchResult,
} from "../types";

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const SCOPES = ["offline_access", "openid", "email", "profile", "User.Read", "Calendars.ReadWrite"];

/** Microsoft Graph adapter for Outlook / Microsoft 365 calendars. */
export class MicrosoftCalendarAdapter implements CalendarAdapter {
  readonly provider = "microsoft" as const;
  private readonly client: Client;

  constructor(credentials: OAuthCredentials) {
    this.client = Client.init({
      authProvider: (done) => done(null, credentials.accessToken),
    });
  }

  static authUrl(config: ProviderOAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      response_mode: "query",
      scope: SCOPES.join(" "),
      state,
    });
    return `${AUTHORITY}/authorize?${params.toString()}`;
  }

  static async exchangeCode(config: ProviderOAuthConfig, code: string): Promise<OAuthCredentials> {
    return MicrosoftCalendarAdapter.tokenRequest(config, {
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    });
  }

  static async refresh(
    config: ProviderOAuthConfig,
    refreshToken: string,
  ): Promise<OAuthCredentials> {
    return MicrosoftCalendarAdapter.tokenRequest(config, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  private static async tokenRequest(
    config: ProviderOAuthConfig,
    grant: Record<string, string>,
  ): Promise<OAuthCredentials> {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: SCOPES.join(" "),
      ...grant,
    });
    const res = await fetch(`${AUTHORITY}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Microsoft token request failed: ${res.status}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
      scope: json.scope,
      tokenType: json.token_type,
    };
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    const res = (await this.client.api("/me/calendars").get()) as {
      value: Array<{ id: string; name: string; isDefaultCalendar?: boolean; hexColor?: string }>;
    };
    return res.value.map((c) => ({
      externalId: c.id,
      name: c.name,
      primary: c.isDefaultCalendar ?? false,
      color: c.hexColor ?? undefined,
    }));
  }

  async getBusy(
    calendarExternalIds: string[],
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyInterval[]> {
    const intervals: BusyInterval[] = [];
    for (const calId of calendarExternalIds) {
      const res = (await this.client
        .api(`/me/calendars/${calId}/calendarView`)
        .query({ startDateTime: timeMin.toISOString(), endDateTime: timeMax.toISOString() })
        .select("start,end,showAs")
        .top(1000)
        .get()) as {
        value: Array<{
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          showAs?: string;
        }>;
      };
      for (const ev of res.value) {
        if (ev.showAs === "free") continue;
        intervals.push({
          start: new Date(`${ev.start.dateTime}Z`),
          end: new Date(`${ev.end.dateTime}Z`),
        });
      }
    }
    return intervals;
  }

  async createEvent(calendarExternalId: string, event: NewCalendarEvent): Promise<CreatedEvent> {
    const created = (await this.client
      .api(`/me/calendars/${calendarExternalId}/events`)
      .post(this.toGraphEvent(event))) as GraphEvent;
    return this.fromGraphEvent(created);
  }

  async updateEvent(
    calendarExternalId: string,
    externalEventId: string,
    event: NewCalendarEvent,
  ): Promise<CreatedEvent> {
    const updated = (await this.client
      .api(`/me/calendars/${calendarExternalId}/events/${externalEventId}`)
      .patch(this.toGraphEvent(event))) as GraphEvent;
    return this.fromGraphEvent(updated);
  }

  async deleteEvent(calendarExternalId: string, externalEventId: string): Promise<void> {
    await this.client.api(`/me/calendars/${calendarExternalId}/events/${externalEventId}`).delete();
  }

  async syncEvents(
    calId: string,
    cursor: string | null,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SyncResult> {
    const busy: BusyEvent[] = [];
    const deletedExternalIds: string[] = [];
    let next: string | null =
      cursor ??
      `/me/calendars/${calId}/calendarView/delta?startDateTime=${windowStart.toISOString()}&endDateTime=${windowEnd.toISOString()}`;
    let nextCursor: string | undefined;

    while (next) {
      const res = (await this.client
        .api(next)
        .header("Prefer", 'outlook.timezone="UTC"')
        .get()) as {
        value: GraphDeltaEvent[];
        "@odata.nextLink"?: string;
        "@odata.deltaLink"?: string;
      };
      for (const ev of res.value ?? []) {
        if (!ev.id) continue;
        if (ev["@removed"]) {
          deletedExternalIds.push(ev.id);
          continue;
        }
        if (ev.showAs === "free") {
          deletedExternalIds.push(ev.id);
          continue;
        }
        if (ev.start?.dateTime && ev.end?.dateTime) {
          busy.push({
            externalEventId: ev.id,
            start: new Date(`${ev.start.dateTime}Z`),
            end: new Date(`${ev.end.dateTime}Z`),
          });
        }
      }
      if (res["@odata.deltaLink"]) {
        nextCursor = res["@odata.deltaLink"];
        next = null;
      } else {
        next = res["@odata.nextLink"] ?? null;
      }
    }

    return { busy, deletedExternalIds, nextCursor };
  }

  async watch(
    calId: string,
    notificationUrl: string,
    clientState: string,
  ): Promise<WatchResult | null> {
    // Microsoft caps calendar-event subscriptions at ~4230 minutes.
    const expiresAt = new Date(Date.now() + 4000 * 60_000);
    const sub = (await this.client.api("/subscriptions").post({
      changeType: "created,updated,deleted",
      notificationUrl,
      resource: `/me/calendars/${calId}/events`,
      expirationDateTime: expiresAt.toISOString(),
      clientState,
    })) as { id: string; expirationDateTime: string };
    return { externalId: sub.id, expiresAt: new Date(sub.expirationDateTime) };
  }

  async unwatch(sub: { externalId: string }): Promise<void> {
    await this.client.api(`/subscriptions/${sub.externalId}`).delete();
  }

  private toGraphEvent(event: NewCalendarEvent): Record<string, unknown> {
    return {
      subject: event.title,
      body: { contentType: "HTML", content: event.description ?? "" },
      start: { dateTime: event.start.toISOString(), timeZone: "UTC" },
      end: { dateTime: event.end.toISOString(), timeZone: "UTC" },
      location: event.location ? { displayName: event.location } : undefined,
      attendees: event.attendees.map((a) => ({
        emailAddress: { address: a.email, name: a.name },
        type: "required",
      })),
      isOnlineMeeting: event.createConference ?? false,
      onlineMeetingProvider: event.createConference ? "teamsForBusiness" : undefined,
    };
  }

  private fromGraphEvent(ev: GraphEvent): CreatedEvent {
    return {
      externalEventId: ev.id,
      htmlLink: ev.webLink,
      meetingUrl: ev.onlineMeeting?.joinUrl,
    };
  }
}

interface GraphEvent {
  id: string;
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
}

interface GraphDeltaEvent {
  id?: string;
  "@removed"?: { reason?: string };
  showAs?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
}
