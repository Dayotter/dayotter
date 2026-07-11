import icalGenerator from "ical-generator";
import ical from "node-ical";
// tsdav is CommonJS; a named ESM import isn't statically resolvable at runtime,
// so import the default and destructure.
import tsdav from "tsdav";
import type {
  BusyInterval,
  CalendarAdapter,
  CreatedEvent,
  ExternalCalendar,
  NewCalendarEvent,
  SyncResult,
  SyncedEvent,
} from "../types";

const { createDAVClient } = tsdav;

const ICLOUD_CALDAV = "https://caldav.icloud.com";

/** Hostnames / IP-literal patterns that must never be used as a CalDAV target —
 * blocks SSRF to cloud metadata, loopback, and private ranges when a user
 * supplies a custom `serverUrl`. */
const BLOCKED_HOST =
  /^(localhost|.*\.local|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|\[?::1\]?|\[?fc00:|\[?fe80:)/i;
const BLOCKED_172 = /^172\.(1[6-9]|2\d|3[01])\./;

/**
 * Reject a user-supplied CalDAV server URL that isn't a public https endpoint.
 * Defends against SSRF (e.g. `http://169.254.169.254/…`, localhost, private
 * ranges) before we make any server-side request to it.
 */
function assertPublicHttpsUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid CalDAV server URL");
  }
  if (url.protocol !== "https:") throw new Error("CalDAV server URL must use https");
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOST.test(host) || BLOCKED_172.test(host)) {
    throw new Error("CalDAV server URL points at a disallowed (internal) host");
  }
}

/** The object shape returned by tsdav's createDAVClient (not the DAVClient class). */
type DAVClientInstance = Awaited<ReturnType<typeof createDAVClient>>;
type DAVCalendar = Awaited<ReturnType<DAVClientInstance["fetchCalendars"]>>[number];

export interface AppleCredentials {
  /** Apple ID email. */
  username: string;
  /** App-specific password generated at appleid.apple.com. */
  password: string;
  /** Override for non-iCloud CalDAV servers (Fastmail, Nextcloud, ...). */
  serverUrl?: string;
}

/**
 * CalDAV adapter (Apple iCloud by default). Unlike Google/Microsoft there are
 * NO push webhooks — the sync worker polls these calendars on an interval and
 * reconciles via CTag/ETag. Construct with {@link AppleCalendarAdapter.connect}.
 */
export class AppleCalendarAdapter implements CalendarAdapter {
  readonly provider = "apple" as const;
  private constructor(
    private readonly client: DAVClientInstance,
    private readonly calendars: DAVCalendar[],
  ) {}

  static async connect(creds: AppleCredentials): Promise<AppleCalendarAdapter> {
    const serverUrl = creds.serverUrl ?? ICLOUD_CALDAV;
    if (creds.serverUrl) assertPublicHttpsUrl(creds.serverUrl);
    const client = await createDAVClient({
      serverUrl,
      credentials: { username: creds.username, password: creds.password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    const calendars = await client.fetchCalendars();
    return new AppleCalendarAdapter(client, calendars);
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    return this.calendars.map((c) => ({
      externalId: c.url,
      name: typeof c.displayName === "string" ? c.displayName : "Calendar",
      timezone: c.timezone,
    }));
  }

  async getBusy(
    calendarExternalIds: string[],
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyInterval[]> {
    const intervals: BusyInterval[] = [];
    for (const url of calendarExternalIds) {
      const calendar = this.calendars.find((c) => c.url === url);
      if (!calendar) continue;
      const objects = await this.client.fetchCalendarObjects({
        calendar,
        timeRange: { start: timeMin.toISOString(), end: timeMax.toISOString() },
      });
      for (const obj of objects) {
        if (!obj.data) continue;
        const parsed = ical.parseICS(obj.data);
        for (const component of Object.values(parsed)) {
          if (component.type === "VEVENT" && component.start && component.end) {
            intervals.push({
              start: new Date(component.start),
              end: new Date(component.end),
            });
          }
        }
      }
    }
    return intervals;
  }

  async createEvent(calendarExternalId: string, event: NewCalendarEvent): Promise<CreatedEvent> {
    const calendar = this.calendars.find((c) => c.url === calendarExternalId);
    if (!calendar) throw new Error(`Unknown calendar ${calendarExternalId}`);

    const uid = `dayotter-${event.start.getTime()}@dayotter`;
    const cal = icalGenerator({ name: "dayotter" });
    cal.createEvent({
      id: uid,
      start: event.start,
      end: event.end,
      summary: event.title,
      description: event.description,
      location: event.location,
      attendees: event.attendees.map((a) => ({ email: a.email, name: a.name })),
    });

    await this.client.createCalendarObject({
      calendar,
      filename: `${uid}.ics`,
      iCalString: cal.toString(),
    });
    return { externalEventId: uid };
  }

  async updateEvent(
    calendarExternalId: string,
    externalEventId: string,
    event: NewCalendarEvent,
  ): Promise<CreatedEvent> {
    // CalDAV update = PUT the object at its URL. Recreate the .ics with same UID.
    const calendar = this.calendars.find((c) => c.url === calendarExternalId);
    if (!calendar) throw new Error(`Unknown calendar ${calendarExternalId}`);

    const cal = icalGenerator({ name: "dayotter" });
    cal.createEvent({
      id: externalEventId,
      start: event.start,
      end: event.end,
      summary: event.title,
      description: event.description,
      location: event.location,
      attendees: event.attendees.map((a) => ({ email: a.email, name: a.name })),
    });

    await this.client.updateCalendarObject({
      calendarObject: {
        url: `${calendar.url}${externalEventId}.ics`,
        data: cal.toString(),
        etag: "",
      },
    });
    return { externalEventId };
  }

  async deleteEvent(calendarExternalId: string, externalEventId: string): Promise<void> {
    const calendar = this.calendars.find((c) => c.url === calendarExternalId);
    if (!calendar) throw new Error(`Unknown calendar ${calendarExternalId}`);
    await this.client.deleteCalendarObject({
      calendarObject: {
        url: `${calendar.url}${externalEventId}.ics`,
        etag: "",
      },
    });
  }

  /**
   * CalDAV has no push webhooks and no cheap per-event delta, so the sync worker
   * polls this on an interval. We re-fetch the window and signal fullResync so
   * the caller replaces the cached busy set for this calendar.
   */
  async syncEvents(
    calId: string,
    _cursor: string | null,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SyncResult> {
    const calendar = this.calendars.find((c) => c.url === calId);
    if (!calendar) return { events: [], deletedExternalIds: [] };

    const objects = await this.client.fetchCalendarObjects({
      calendar,
      timeRange: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    });

    const events: SyncedEvent[] = [];
    for (const obj of objects) {
      if (!obj.data) continue;
      const parsed = ical.parseICS(obj.data);
      for (const [key, component] of Object.entries(parsed)) {
        if (component.type === "VEVENT" && component.start && component.end) {
          const c = component as {
            uid?: string;
            summary?: string;
            description?: string;
            location?: string;
            transparency?: string;
            rrule?: unknown;
            organizer?: { params?: { CN?: string }; val?: string };
          };
          const uid = c.uid ?? obj.url ?? key;
          events.push({
            externalEventId: uid,
            start: new Date(component.start),
            end: new Date(component.end),
            title: c.summary,
            description: c.description,
            location: c.location,
            organizer: c.organizer
              ? {
                  name: c.organizer.params?.CN,
                  email: c.organizer.val?.replace(/^mailto:/i, ""),
                }
              : undefined,
            transparency: c.transparency === "TRANSPARENT" ? "transparent" : "opaque",
            isRecurring: Boolean(c.rrule),
            status: "confirmed",
            visibility: "default",
          });
        }
      }
    }

    return {
      events,
      deletedExternalIds: [],
      fullResync: true,
      nextCursor: typeof calendar.ctag === "string" ? calendar.ctag : undefined,
    };
  }
}
