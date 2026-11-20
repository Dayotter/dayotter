import { resolvePublicIp, safeFetch } from "@dayotter/core";
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

/**
 * A `fetch()` that pins the connection to the host's validated public IP (via the
 * core SSRF transport), so `tsdav` cannot be steered at an internal address by DNS
 * rebinding between our check and its connect. Passed to `createDAVClient`, which
 * threads it through every request (discovery, calendar list, busy sync, writes).
 */
const caldavSafeFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((v, k) => {
    headers[k] = v;
  });
  return safeFetch(url, {
    method: init?.method,
    headers,
    body: typeof init?.body === "string" ? init.body : undefined,
    timeoutMs: 30_000,
  });
};

/**
 * Baseline managed CalDAV hosts, used only when an operator opts into restricting
 * connections via `CALDAV_ALLOWED_HOSTS`. When that env var is unset, any public
 * https host is allowed - the SSRF control is the IP pin in `caldavSafeFetch`, not
 * this list.
 */
const DEFAULT_CALDAV_HOSTS = [
  "icloud.com",
  "me.com",
  "mac.com",
  "fastmail.com",
  "messagingengine.com",
  "mailbox.org",
  "posteo.de",
  "posteo.net",
  "gmx.net",
  "web.de",
  "zoho.com",
  "yahoo.com",
];

/** Hosts an operator confined CalDAV connections to via CALDAV_ALLOWED_HOSTS (empty = no restriction). */
function envCaldavHosts(): string[] {
  return (process.env.CALDAV_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Thrown when a CalDAV server URL is rejected before authentication (bad URL, not
 * https, host not allowed, or internal). Lets the caller show the real reason
 * instead of blaming the user's credentials.
 */
export class CaldavConfigError extends Error {}

/**
 * Validate a user-supplied CalDAV server URL before connecting. The load-bearing
 * SSRF control is that every request is pinned to the host's validated public IP
 * (see {@link caldavSafeFetch}), which closes DNS-rebinding regardless of what the
 * host later resolves to - so any public https host is allowed by default, and the
 * connection itself is the per-user confirmation (it persists only after the
 * credentials authenticate). `CALDAV_ALLOWED_HOSTS` is an OPTIONAL operator
 * restriction: when set, connections are confined to the managed providers plus
 * the listed hosts. iCloud connections pass no serverUrl and skip this entirely.
 */
async function assertPublicHttpsUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CaldavConfigError("Invalid CalDAV server URL");
  }
  if (url.protocol !== "https:") throw new CaldavConfigError("CalDAV server URL must use https");

  const restrictTo = envCaldavHosts();
  if (restrictTo.length > 0) {
    const host = url.hostname.toLowerCase();
    const allowed = [...DEFAULT_CALDAV_HOSTS, ...restrictTo].some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    if (!allowed) {
      throw new CaldavConfigError(
        "That CalDAV host isn't allowed on this instance. Ask your admin to add it to CALDAV_ALLOWED_HOSTS.",
      );
    }
  }

  // Reject hosts that resolve to an internal address; caldavSafeFetch then pins
  // the connection to this validated public IP on every request.
  try {
    await resolvePublicIp(url.hostname);
  } catch {
    throw new CaldavConfigError("CalDAV server URL points at a disallowed (internal) host");
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
 * NO push webhooks - the sync worker polls these calendars on an interval and
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
    if (creds.serverUrl) await assertPublicHttpsUrl(creds.serverUrl);
    const client = await createDAVClient({
      serverUrl,
      credentials: { username: creds.username, password: creds.password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
      fetch: caldavSafeFetch,
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
