/**
 * Default reminder lead times, in minutes before the event (1 day, then 1 hour).
 * The single source of truth for the product's default reminder cadence — used
 * as the DB/API/UI default and the fallback when a host has no preference set.
 */
export const DEFAULT_REMINDER_OFFSETS = [1440, 60] as const;
