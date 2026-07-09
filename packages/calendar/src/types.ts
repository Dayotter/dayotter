export type Provider = "google" | "microsoft" | "apple";

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  /** Epoch millis when the access token expires. */
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
}

/** Called when an adapter refreshes tokens so the caller can persist them. */
export type CredentialRefreshHandler = (creds: OAuthCredentials) => void | Promise<void>;

export interface ExternalCalendar {
  externalId: string;
  name: string;
  primary?: boolean;
  timezone?: string;
  color?: string;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface EventAttendee {
  email: string;
  name?: string;
}

export interface NewCalendarEvent {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
  attendees: EventAttendee[];
  location?: string;
  /** Request a provider-generated video conference (Meet / Teams). */
  createConference?: boolean;
}

export interface CreatedEvent {
  externalEventId: string;
  htmlLink?: string;
  meetingUrl?: string;
}

/** An attendee on a synced event. */
export interface SyncedAttendee {
  email: string;
  name?: string;
  responseStatus?: string;
}

/**
 * A full external event mapped into calSync's unified model. Times + id are
 * always present; the rest is populated best-effort from what each provider
 * exposes. `transparency: "transparent"` means the event doesn't block time.
 */
export interface SyncedEvent {
  externalEventId: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  title?: string;
  description?: string;
  location?: string;
  meetingUrl?: string;
  organizer?: { email?: string; name?: string };
  attendees?: SyncedAttendee[];
  status?: "confirmed" | "tentative" | "cancelled";
  visibility?: "default" | "public" | "private";
  transparency?: "opaque" | "transparent";
  recurringEventId?: string;
  isRecurring?: boolean;
  timezone?: string;
}

/** @deprecated use {@link SyncedEvent}. */
export type BusyEvent = SyncedEvent;

/** The result of an incremental change fetch. */
export interface SyncResult {
  /** Full events created/updated since the last cursor. */
  events: SyncedEvent[];
  /** Event ids removed/cancelled since the last cursor. */
  deletedExternalIds: string[];
  /** Opaque cursor to pass to the next syncEvents call (syncToken / deltaLink / ctag). */
  nextCursor?: string;
  /** true when the provider invalidated the cursor — caller should wipe + full-resync. */
  fullResync?: boolean;
}

/** How the user has responded to an invitation. */
export type InviteResponseStatus = "needsAction" | "accepted" | "declined" | "tentative";

/** The action a user can take on a pending invitation. */
export type InviteResponse = "accepted" | "declined" | "tentative";

/** An event the user has been invited to (their own attendance status). */
export interface CalendarInvite {
  externalEventId: string;
  calendarExternalId: string;
  title: string;
  start: Date;
  end: Date;
  organizer?: { name?: string; email?: string };
  location?: string;
  meetingUrl?: string;
  responseStatus: InviteResponseStatus;
}

/** A created push-notification subscription. */
export interface WatchResult {
  /** Provider-side subscription / channel id. */
  externalId: string;
  /** Google resource id (needed to stop the channel); unused elsewhere. */
  resourceId?: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Uniform interface every provider implements. The rest of the app talks to
 * calendars only through this — swapping/adding providers never leaks upward.
 */
export interface CalendarAdapter {
  readonly provider: Provider;
  listCalendars(): Promise<ExternalCalendar[]>;
  /** Busy intervals across the given calendars within [timeMin, timeMax]. */
  getBusy(calendarExternalIds: string[], timeMin: Date, timeMax: Date): Promise<BusyInterval[]>;
  createEvent(calendarExternalId: string, event: NewCalendarEvent): Promise<CreatedEvent>;
  updateEvent(
    calendarExternalId: string,
    externalEventId: string,
    event: NewCalendarEvent,
  ): Promise<CreatedEvent>;
  deleteEvent(calendarExternalId: string, externalEventId: string): Promise<void>;

  /**
   * Incremental change fetch. Pass the cursor from the previous call (null on
   * first sync — the window seeds the initial set). Returns changed/removed
   * events and a cursor for next time.
   */
  syncEvents(
    calendarExternalId: string,
    cursor: string | null,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<SyncResult>;

  /** Create a push-notification subscription. Returns null if unsupported (CalDAV). */
  watch?(
    calendarExternalId: string,
    notificationUrl: string,
    clientState: string,
  ): Promise<WatchResult | null>;

  /** Tear down a push subscription. */
  unwatch?(subscription: { externalId: string; resourceId?: string }): Promise<void>;

  /**
   * Events the user has been invited to but not yet responded to, within the
   * window. Optional — providers without an RSVP concept (CalDAV) omit it.
   */
  listInvites?(
    calendarExternalId: string,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<CalendarInvite[]>;

  /** RSVP to an invitation (accept / decline / tentative), notifying the organizer. */
  respondToInvite?(
    calendarExternalId: string,
    externalEventId: string,
    response: InviteResponse,
  ): Promise<void>;
}

export interface ProviderOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
