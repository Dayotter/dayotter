import type { CalendlyAvailabilitySchedule, CalendlyEventType } from "./calendly";

const CALENDLY_API = "https://api.calendly.com";
const TIMEOUT_MS = 15_000;

/** Thrown when Calendly rejects the token (401) - surfaced to the user distinctly. */
export class CalendlyAuthError extends Error {
  constructor() {
    super("Calendly rejected the access token");
    this.name = "CalendlyAuthError";
  }
}

/** Everything we pull from Calendly for one user, ready to hand to the importer. */
export interface RawCalendlyExport {
  user: { name: string; uri: string };
  eventTypes: CalendlyEventType[];
  schedules: CalendlyAvailabilitySchedule[];
}

interface Paginated<T> {
  collection: T[];
  pagination?: { next_page?: string | null };
}

async function cget<T>(token: string, url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      signal: controller.signal,
    });
    if (res.status === 401) throw new CalendlyAuthError();
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Calendly ${res.status}: ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Follow Calendly's cursor pagination, concatenating every page's collection. */
async function collectAll<T>(token: string, firstUrl: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null | undefined = firstUrl;
  // Guard against a pathological pagination loop.
  for (let page = 0; next && page < 50; page++) {
    const data: Paginated<T> = await cget<Paginated<T>>(token, next);
    out.push(...(data.collection ?? []));
    next = data.pagination?.next_page ?? null;
  }
  return out;
}

/**
 * Fetch the current Calendly user's event types + availability schedules using a
 * Personal Access Token. Only reads - never writes to Calendly.
 */
export async function fetchCalendlyExport(token: string): Promise<RawCalendlyExport> {
  const me = await cget<{ resource: { uri: string; name?: string } }>(
    token,
    `${CALENDLY_API}/users/me`,
  );
  const userUri = me.resource.uri;
  const userParam = encodeURIComponent(userUri);

  const eventTypes = await collectAll<CalendlyEventType>(
    token,
    `${CALENDLY_API}/event_types?user=${userParam}&count=100`,
  );
  const schedules = await collectAll<CalendlyAvailabilitySchedule>(
    token,
    `${CALENDLY_API}/user_availability_schedules?user=${userParam}`,
  );

  return { user: { name: me.resource.name ?? "", uri: userUri }, eventTypes, schedules };
}
