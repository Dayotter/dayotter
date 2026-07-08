import { randomUUID } from "node:crypto";
import { google, type calendar_v3 } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import type {
  BusyEvent,
  BusyInterval,
  CalendarAdapter,
  CreatedEvent,
  CredentialRefreshHandler,
  ExternalCalendar,
  NewCalendarEvent,
  OAuthCredentials,
  ProviderOAuthConfig,
  SyncResult,
  WatchResult,
} from "../types";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
  "profile",
];

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = "google" as const;
  private readonly client: OAuth2Client;
  private readonly api: calendar_v3.Calendar;

  constructor(
    config: ProviderOAuthConfig,
    credentials: OAuthCredentials,
    onRefresh?: CredentialRefreshHandler,
  ) {
    this.client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    this.client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiresAt,
      scope: credentials.scope,
      token_type: credentials.tokenType,
    });
    // Persist rotated tokens so we never lose the refresh token.
    this.client.on("tokens", (tokens: Credentials) => {
      void onRefresh?.({
        accessToken: tokens.access_token ?? credentials.accessToken,
        refreshToken: tokens.refresh_token ?? credentials.refreshToken,
        expiresAt: tokens.expiry_date ?? credentials.expiresAt,
        scope: tokens.scope ?? credentials.scope,
        tokenType: tokens.token_type ?? credentials.tokenType,
      });
    });
    this.api = google.calendar({ version: "v3", auth: this.client });
  }

  /** Build the consent URL to start the OAuth flow. */
  static authUrl(config: ProviderOAuthConfig, state: string): string {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    return client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state,
    });
  }

  /** Exchange an authorization code for tokens. */
  static async exchangeCode(config: ProviderOAuthConfig, code: string): Promise<OAuthCredentials> {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    const { tokens } = await client.getToken(code);
    return {
      accessToken: tokens.access_token ?? "",
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ?? undefined,
      scope: tokens.scope ?? undefined,
      tokenType: tokens.token_type ?? undefined,
    };
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    const { data } = await this.api.calendarList.list({ maxResults: 250 });
    return (data.items ?? []).map((c) => ({
      externalId: c.id ?? "",
      name: c.summary ?? c.id ?? "Calendar",
      primary: c.primary ?? false,
      timezone: c.timeZone ?? undefined,
      color: c.backgroundColor ?? undefined,
    }));
  }

  async getBusy(
    calendarExternalIds: string[],
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyInterval[]> {
    const { data } = await this.api.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarExternalIds.map((id) => ({ id })),
      },
    });
    const calendars = data.calendars ?? {};
    const intervals: BusyInterval[] = [];
    for (const cal of Object.values(calendars)) {
      for (const b of cal.busy ?? []) {
        if (b.start && b.end) {
          intervals.push({ start: new Date(b.start), end: new Date(b.end) });
        }
      }
    }
    return intervals;
  }

  async createEvent(calendarExternalId: string, event: NewCalendarEvent): Promise<CreatedEvent> {
    const requestBody = this.toGoogleEvent(event);
    const { data } = await this.api.events.insert({
      calendarId: calendarExternalId,
      conferenceDataVersion: event.createConference ? 1 : 0,
      sendUpdates: "all",
      requestBody,
    });
    return this.fromGoogleEvent(data);
  }

  async updateEvent(
    calendarExternalId: string,
    externalEventId: string,
    event: NewCalendarEvent,
  ): Promise<CreatedEvent> {
    const { data } = await this.api.events.update({
      calendarId: calendarExternalId,
      eventId: externalEventId,
      conferenceDataVersion: event.createConference ? 1 : 0,
      sendUpdates: "all",
      requestBody: this.toGoogleEvent(event),
    });
    return this.fromGoogleEvent(data);
  }

  async deleteEvent(calendarExternalId: string, externalEventId: string): Promise<void> {
    await this.api.events.delete({
      calendarId: calendarExternalId,
      eventId: externalEventId,
      sendUpdates: "all",
    });
  }

  async syncEvents(
    calId: string,
    cursor: string | null,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SyncResult> {
    const busy: BusyEvent[] = [];
    const deletedExternalIds: string[] = [];
    let nextCursor: string | undefined;
    let pageToken: string | undefined;

    try {
      do {
        const { data }: { data: calendar_v3.Schema$Events } = await this.api.events.list({
          calendarId: calId,
          singleEvents: true,
          showDeleted: true,
          maxResults: 2500,
          pageToken,
          ...(cursor
            ? { syncToken: cursor }
            : { timeMin: windowStart.toISOString(), timeMax: windowEnd.toISOString() }),
        });
        for (const ev of data.items ?? []) {
          if (!ev.id) continue;
          // Cancelled or free-time events must not count as busy (and are removed).
          if (ev.status === "cancelled" || ev.transparency === "transparent") {
            deletedExternalIds.push(ev.id);
            continue;
          }
          const start = ev.start?.dateTime ?? ev.start?.date;
          const end = ev.end?.dateTime ?? ev.end?.date;
          if (start && end) {
            busy.push({ externalEventId: ev.id, start: new Date(start), end: new Date(end) });
          }
        }
        pageToken = data.nextPageToken ?? undefined;
        if (data.nextSyncToken) nextCursor = data.nextSyncToken;
      } while (pageToken);
    } catch (err) {
      // 410 Gone → the syncToken expired; the caller should wipe and full-resync.
      if ((err as { code?: number }).code === 410) {
        return { busy: [], deletedExternalIds: [], fullResync: true };
      }
      throw err;
    }

    return { busy, deletedExternalIds, nextCursor };
  }

  async watch(
    calId: string,
    notificationUrl: string,
    clientState: string,
  ): Promise<WatchResult | null> {
    const channelId = randomUUID();
    const { data } = await this.api.events.watch({
      calendarId: calId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: notificationUrl,
        token: clientState,
      },
    });
    return {
      externalId: data.id ?? channelId,
      resourceId: data.resourceId ?? undefined,
      expiresAt: data.expiration
        ? new Date(Number(data.expiration))
        : new Date(Date.now() + 7 * 86_400_000),
      metadata: { resourceId: data.resourceId ?? null },
    };
  }

  async unwatch(sub: { externalId: string; resourceId?: string }): Promise<void> {
    await this.api.channels.stop({
      requestBody: { id: sub.externalId, resourceId: sub.resourceId },
    });
  }

  private toGoogleEvent(event: NewCalendarEvent): calendar_v3.Schema$Event {
    const body: calendar_v3.Schema$Event = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start.toISOString(), timeZone: event.timezone },
      end: { dateTime: event.end.toISOString(), timeZone: event.timezone },
      attendees: event.attendees.map((a) => ({ email: a.email, displayName: a.name })),
    };
    if (event.createConference) {
      body.conferenceData = {
        createRequest: {
          requestId: `calsync-${event.start.getTime()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }
    return body;
  }

  private fromGoogleEvent(data: calendar_v3.Schema$Event): CreatedEvent {
    return {
      externalEventId: data.id ?? "",
      htmlLink: data.htmlLink ?? undefined,
      meetingUrl: data.hangoutLink ?? data.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
    };
  }
}
