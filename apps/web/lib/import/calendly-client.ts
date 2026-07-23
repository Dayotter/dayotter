import type { CalendlyAvailabilitySchedule, CalendlyEventType } from "./calendly";

const CALENDLY_API = "https://api.calendly.com";
const CALENDLY_ORIGIN = "https://api.calendly.com/";
const TIMEOUT_MS = 15_000;
/** Hard cap on any single page body (defends against a huge/hostile response). */
const MAX_BODY_BYTES = 5 * 1024 * 1024;
/** Cap on items pulled per resource, so one import can't commit unbounded rows. */
export const MAX_EVENT_TYPES = 200;
export const MAX_SCHEDULES = 50;

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

/** Read a response body with a hard byte ceiling, aborting past the cap. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error("Calendly response too large");
      }
      text += decoder.decode(value, { stream: true });
    }
  }
  return text + decoder.decode();
}

async function cget<T>(token: string, url: string): Promise<T> {
  // Only ever talk to Calendly. The first URL is a constant; `next_page` comes
  // from the response body, so pin it to Calendly's origin and refuse redirects
  // - otherwise a bad/redirecting URL could carry the Bearer token off-host.
  if (!url.startsWith(CALENDLY_ORIGIN)) {
    throw new Error("Refusing to fetch a non-Calendly URL");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      signal: controller.signal,
      redirect: "error",
    });
    if (res.status === 401) throw new CalendlyAuthError();
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Calendly ${res.status}: ${detail.slice(0, 200)}`);
    }
    return JSON.parse(await readCapped(res)) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Follow Calendly's cursor pagination, concatenating pages up to `limit` items. */
async function collectAll<T>(token: string, firstUrl: string, limit: number): Promise<T[]> {
  const out: T[] = [];
  let next: string | null | undefined = firstUrl;
  // Bounded by both a page cap (loop guard) and the item cap (`limit`).
  for (let page = 0; next && page < 50 && out.length < limit; page++) {
    const data: Paginated<T> = await cget<Paginated<T>>(token, next);
    out.push(...(data.collection ?? []));
    next = data.pagination?.next_page ?? null;
  }
  return out.slice(0, limit);
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
    MAX_EVENT_TYPES,
  );
  const schedules = await collectAll<CalendlyAvailabilitySchedule>(
    token,
    `${CALENDLY_API}/user_availability_schedules?user=${userParam}`,
    MAX_SCHEDULES,
  );

  return { user: { name: me.resource.name ?? "", uri: userUri }, eventTypes, schedules };
}
