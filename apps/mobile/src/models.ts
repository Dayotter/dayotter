// DTOs mirroring the calSync REST API. `Slot` is re-exported from the shared
// core package — the exact same type the web app + availability engine use.
export type { Slot } from "@calsync/core/availability";

export interface AppUser {
  id: string;
  name: string | null;
  email: string;
  handle: string | null;
  timezone: string;
}

export type LocationType = "google_meet" | "ms_teams" | "zoom" | "phone" | "in_person" | "custom";

export type QuestionType = "text" | "textarea" | "email" | "phone" | "select" | "checkbox";

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
  bookingWindowDays: number | null;
  dailyBookingLimit: number | null;
  isPrivate: boolean;
  redirectUrl: string | null;
  questions: BookingQuestion[];
  isActive: boolean;
}

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
