import { Client } from "@microsoft/microsoft-graph-client";
import type {
  BusyInterval,
  CalendarAdapter,
  CalendarInvite,
  CreatedEvent,
  ExternalCalendar,
  InviteResponse,
  NewCalendarEvent,
  OAuthCredentials,
  ProviderOAuthConfig,
  SyncResult,
  SyncedEvent,
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
    const events: SyncedEvent[] = [];
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
        if (ev["@removed"] || ev.isCancelled) {
          deletedExternalIds.push(ev.id);
          continue;
        }
        if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
        const sensitivity = ev.sensitivity ?? "";
        events.push({
          externalEventId: ev.id,
          start: new Date(`${ev.start.dateTime}Z`),
          end: new Date(`${ev.end.dateTime}Z`),
          allDay: Boolean(ev.isAllDay),
          title: ev.subject ?? undefined,
          description: ev.bodyPreview ?? undefined,
          location: ev.location?.displayName ?? undefined,
          meetingUrl: ev.onlineMeeting?.joinUrl ?? undefined,
          organizer: ev.organizer?.emailAddress
            ? { email: ev.organizer.emailAddress.address, name: ev.organizer.emailAddress.name }
            : undefined,
          attendees: (ev.attendees ?? [])
            .filter((a) => a.emailAddress?.address)
            .map((a) => ({
              email: a.emailAddress!.address as string,
              name: a.emailAddress?.name,
              responseStatus: a.status?.response,
            })),
          status: ev.showAs === "tentative" ? "tentative" : "confirmed",
          visibility:
            sensitivity === "private" ||
            sensitivity === "confidential" ||
            sensitivity === "personal"
              ? "private"
              : "default",
          transparency: ev.showAs === "free" ? "transparent" : "opaque",
          recurringEventId: ev.seriesMasterId ?? undefined,
          isRecurring: Boolean(ev.seriesMasterId) || ev.type === "seriesMaster",
        });
      }
      if (res["@odata.deltaLink"]) {
        nextCursor = res["@odata.deltaLink"];
        next = null;
      } else {
        next = res["@odata.nextLink"] ?? null;
      }
    }

    return { events, deletedExternalIds, nextCursor };
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

  async listInvites(calId: string, windowStart: Date, windowEnd: Date): Promise<CalendarInvite[]> {
    const res = (await this.client
      .api(`/me/calendars/${calId}/calendarView`)
      .header("Prefer", 'outlook.timezone="UTC"')
      .query({ startDateTime: windowStart.toISOString(), endDateTime: windowEnd.toISOString() })
      .select("id,subject,start,end,location,organizer,responseStatus,onlineMeeting")
      .top(250)
      .get()) as { value: GraphInviteEvent[] };

    const invites: CalendarInvite[] = [];
    for (const ev of res.value ?? []) {
      if (!ev.id) continue;
      const r = ev.responseStatus?.response;
      if (r !== "notResponded" && r !== "none") continue; // only un-answered
      if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
      invites.push({
        externalEventId: ev.id,
        calendarExternalId: calId,
        title: ev.subject ?? "(no title)",
        start: new Date(`${ev.start.dateTime}Z`),
        end: new Date(`${ev.end.dateTime}Z`),
        organizer: ev.organizer?.emailAddress
          ? { name: ev.organizer.emailAddress.name, email: ev.organizer.emailAddress.address }
          : undefined,
        location: ev.location?.displayName ?? undefined,
        meetingUrl: ev.onlineMeeting?.joinUrl ?? undefined,
        responseStatus: "needsAction",
      });
    }
    return invites;
  }

  async respondToInvite(_calId: string, eventId: string, response: InviteResponse): Promise<void> {
    const action =
      response === "accepted"
        ? "accept"
        : response === "declined"
          ? "decline"
          : "tentativelyAccept";
    // Graph's RSVP actions live on /me/events/{id}; sendResponse notifies the organizer.
    await this.client.api(`/me/events/${eventId}/${action}`).post({ sendResponse: true });
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
  subject?: string;
  bodyPreview?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  sensitivity?: string;
  type?: string;
  seriesMasterId?: string;
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  attendees?: {
    emailAddress?: { name?: string; address?: string };
    status?: { response?: string };
  }[];
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
}

interface GraphInviteEvent {
  id?: string;
  subject?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  responseStatus?: { response?: string; time?: string };
  onlineMeeting?: { joinUrl?: string };
}
