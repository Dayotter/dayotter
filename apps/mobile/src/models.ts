// DTOs mirroring the DayOtter REST API. `Slot` is re-exported from the shared
// core package - the exact same type the web app + availability engine use.
export type { Slot } from "@dayotter/core/availability";

export interface AppUser {
  id: string;
  name: string | null;
  email: string;
  handle: string | null;
  timezone: string;
}

export type LocationType = "google_meet" | "ms_teams" | "zoom" | "phone" | "in_person" | "custom";

export type QuestionType = "text" | "textarea" | "email" | "phone" | "select" | "checkbox";

export type EventColor = "violet" | "mint" | "amber" | "coral" | "sky";

/** Token name → hex, mirroring the web design system's event hues. */
export const EVENT_COLOR_HEX: Record<EventColor, string> = {
  violet: "#6743e6",
  mint: "#16a085",
  amber: "#d98829",
  coral: "#ef6a52",
  sky: "#3b82f6",
};

export function eventColorHex(color: string | null | undefined): string {
  return color && color in EVENT_COLOR_HEX
    ? EVENT_COLOR_HEX[color as EventColor]
    : EVENT_COLOR_HEX.violet;
}

export interface BookingQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
}

export interface EventType {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  description: string | null;
  isActive: boolean;
  color: string | null;
  url: string | null;
}

/** Full event type returned by GET /api/event-types/[id] (edit form). */
export interface EventTypeDetail {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  description: string | null;
  location: LocationType;
  locationDetail: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  slotIntervalMinutes: number | null;
  minimumGapMinutes: number;
  durationOptions: number[] | null;
  bookingWindowDays: number | null;
  dailyBookingLimit: number | null;
  isPrivate: boolean;
  redirectUrl: string | null;
  color: string | null;
  price: number | null;
  currency: string | null;
  depositAmount: number | null;
  questions: BookingQuestion[];
  isActive: boolean;
}

export const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "inr"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  usd: "$",
  eur: "€",
  gbp: "£",
  cad: "C$",
  aud: "A$",
  inr: "₹",
};

export type ChannelType = "slack" | "whatsapp" | "sms" | "push";

export interface NotificationChannel {
  id: string;
  type: ChannelType | "email";
  label: string;
  isVerified: boolean;
  remindersEnabled: boolean;
}

export interface UserPreferences {
  timeFormat: "12h" | "24h";
  weekStartsOn: number;
  theme: "system" | "light" | "dark";
  defaultReminderOffsets: number[];
  adaptiveAvailability?: boolean;
  maxMeetingsPerDay?: number;
  travelBufferMinutes?: number;
}

/** Automation rule (GET/POST /api/automations). */
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: string;
  matchTitle: string | null;
  action: string;
  offsetMinutes: number;
  blockTitle: string | null;
  dayOfWeek: number | null;
  windowStart: string | null;
  windowEnd: string | null;
}

/** An automated attendee-messaging workflow (GET /api/workflows). */
export interface Workflow {
  id: string;
  name: string;
  trigger: "before_event" | "after_event";
  offsetMinutes: number;
  action: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  eventTypeIds: string[];
}

/** A connected calendar account (GET /api/calendars). */
export interface CalendarConnection {
  id: string;
  provider: "google" | "microsoft" | "apple";
  account: string;
  status: string;
  calendarCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/** An API key (GET/POST /api/api-keys). */
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Calendar Inbox (GET /api/inbox). */
export interface InboxReconnect {
  connectionId: string;
  provider: string;
  account: string;
  error: string | null;
}
export interface InboxConflict {
  uid: string;
  title: string;
  startsAt: string;
  clashTitle: string;
}
export interface InboxData {
  reconnect: InboxReconnect[];
  conflicts: InboxConflict[];
}

/** Booking-funnel analytics (GET /api/analytics). */
export interface AnalyticsTotals {
  views: number;
  uniqueVisitors: number;
  bookings: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenueCents: number;
  conversionRate: number;
}
export interface AnalyticsRow {
  eventTypeId: string;
  title: string;
  color: string | null;
  views: number;
  uniqueVisitors: number;
  confirmed: number;
  cancelled: number;
  noShow: number;
  revenueCents: number;
  currency: string | null;
  conversionRate: number;
}
export interface Analytics {
  totals: AnalyticsTotals;
  currency: string | null;
  byEventType: AnalyticsRow[];
}

/** An Intelligence recommendation (GET /api/recommendations). */
export interface Recommendation {
  id: string;
  icon: "sun" | "layers" | "calendar-x" | "gauge" | "shield";
  title: string;
  detail: string;
}

/** One booking in the calendar range response (GET /api/bookings/range). */
export interface RangeBooking {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  color: string | null;
  attendees: string[];
}

/** Scheduling-scoped time insights (GET /api/insights). */
export interface Insights {
  upcomingCount: number;
  bookedMinutes: number;
  busiestWeekday: number | null;
  avgPerWeek: number;
  thisWeek: number;
  weekday: number[];
  byType: { title: string; color: string | null; minutes: number }[];
}

export interface Attendee {
  name: string | null;
  email: string;
}

export interface Booking {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  meetingUrl: string | null;
  attendees: Attendee[];
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
}

export interface BookingDetail extends Booking {
  eventTypeId: string;
  hostName: string | null;
}

export interface Schedule {
  timezone: string;
  days: { start: string; end: string }[][]; // index 0..6 = Sun..Sat
}
