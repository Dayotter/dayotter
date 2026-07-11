import { eventsToBusy, fetchIcsFeed, parseIcsEvents } from "@dayotter/calendar";

/**
 * SavvyCal-style calendar overlay: given a booker-supplied calendar feed URL,
 * return the busy intervals in a window so the public booking page can grey out
 * slots that clash with the booker's OWN commitments. The feed is fetched
 * per-request and never stored; only busy/free times are derived from it.
 *
 * The actual fetch + ICS parse lives in `@dayotter/calendar` (shared with the
 * ICS-feed calendar provider); this module just adapts it to the public
 * booking-page contract (ISO-string intervals).
 */

export interface BusyInterval {
  start: string; // ISO
  end: string; // ISO
}

/**
 * Parse an ICS document into busy intervals overlapping [from, to]. Recurrence-
 * aware and skips events marked free (TRANSPARENT) or CANCELLED. Exported for
 * unit testing.
 */
export function icsToBusy(icsText: string, from: Date, to: Date): BusyInterval[] {
  return eventsToBusy(parseIcsEvents(icsText, from, to)).map((i) => ({
    start: i.start.toISOString(),
    end: i.end.toISOString(),
  }));
}

/** Fetch + parse a booker's calendar feed into busy intervals for [from, to]. */
export async function fetchBookerBusy(
  icsUrl: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  const text = await fetchIcsFeed(icsUrl);
  return icsToBusy(text, from, to);
}
