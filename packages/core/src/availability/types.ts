/** A recurring weekly window in the schedule's timezone. dayOfWeek: 0=Sun..6=Sat. */
export interface WeeklyRule {
  dayOfWeek: number;
  /** "HH:mm" or "HH:mm:ss" local to the schedule timezone. */
  startTime: string;
  endTime: string;
}

/** A one-off override for a specific calendar date. */
export interface DateOverride {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** null start & end => unavailable all day. */
  startTime: string | null;
  endTime: string | null;
}

/** An absolute busy interval pulled from a connected calendar. */
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface Schedule {
  /** IANA timezone, e.g. "America/New_York". */
  timezone: string;
  rules: WeeklyRule[];
  overrides: DateOverride[];
}

export interface EventConstraints {
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  /** Slot cadence; defaults to durationMinutes when unset. */
  slotIntervalMinutes?: number;
  /** Max days into the future bookable; null/undefined = unlimited. */
  bookingWindowDays?: number | null;
}

export interface AvailabilityInput {
  schedule: Schedule;
  busy: BusyInterval[];
  event: EventConstraints;
  /** Window the caller wants slots for (absolute instants). */
  rangeStart: Date;
  rangeEnd: Date;
  /** Current time; slots before now + minimumNotice are excluded. */
  now: Date;
}

export interface Slot {
  start: Date;
  end: Date;
}
