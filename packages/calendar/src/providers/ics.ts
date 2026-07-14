import { eventsToBusy, fetchIcsFeed, parseIcsEvents } from "../ics";
import type {
  BusyInterval,
  CalendarAdapter,
  CreatedEvent,
  ExternalCalendar,
  SyncResult,
} from "../types";

/** The single synthetic calendar id an ICS feed exposes (a feed is one calendar). */
export const ICS_FEED_CALENDAR_ID = "feed";

/**
 * A read-only calendar backed by an external ICS / webcal feed URL. Poll-only
 * (no push subscriptions, no RSVP, no writes) - the maintenance tick re-fetches
 * it like a CalDAV account. Every sync is a full snapshot: ICS has no delta, so
 * we return `fullResync` and let the sync worker wipe + reinsert, which handles
 * removed events for free.
 */
export class IcsFeedAdapter implements CalendarAdapter {
  readonly provider = "ics" as const;

  constructor(
    private readonly feedUrl: string,
    private readonly displayName = "Calendar feed",
  ) {}

  async listCalendars(): Promise<ExternalCalendar[]> {
    return [{ externalId: ICS_FEED_CALENDAR_ID, name: this.displayName, primary: false }];
  }

  async getBusy(_ids: string[], timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
    const text = await fetchIcsFeed(this.feedUrl);
    return eventsToBusy(parseIcsEvents(text, timeMin, timeMax));
  }

  async syncEvents(
    _calendarExternalId: string,
    _cursor: string | null,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SyncResult> {
    const text = await fetchIcsFeed(this.feedUrl);
    const events = parseIcsEvents(text, windowStart, windowEnd);
    // No incremental cursor for ICS - treat every sync as a fresh snapshot so the
    // worker wipes stale rows and reinserts, correctly dropping removed events.
    return { events, deletedExternalIds: [], fullResync: true };
  }

  createEvent(): Promise<CreatedEvent> {
    throw new Error("ICS feed calendars are read-only");
  }

  updateEvent(): Promise<CreatedEvent> {
    throw new Error("ICS feed calendars are read-only");
  }

  deleteEvent(): Promise<void> {
    throw new Error("ICS feed calendars are read-only");
  }
}
