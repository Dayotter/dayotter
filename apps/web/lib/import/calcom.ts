import type { LocationTypeValue } from "../booking/event-type-input";

/**
 * Pure mapping layer: Cal.com API v1 event-type shapes -> the fields DayOtter
 * stores. No network / DB access, so it can be exhaustively unit-tested; the
 * client (`calcom-client.ts`) and persistence (`run-import.ts`) wrap it. Only the
 * subset of Cal.com's payload we actually use is typed.
 *
 * Cal.com's `locations` is an array of `{ type, address?, link?, ... }` where
 * `type` is a namespaced string (e.g. `integrations:google:meet`, `inPerson`).
 */

export interface CalcomLocation {
  type?: string;
  address?: string | null;
  link?: string | null;
  hostPhoneNumber?: string | null;
  [k: string]: unknown;
}

export interface CalcomEventType {
  id?: number;
  title?: string;
  slug?: string | null;
  length?: number; // minutes
  description?: string | null;
  hidden?: boolean;
  requiresConfirmation?: boolean;
  minimumBookingNotice?: number; // minutes
  locations?: CalcomLocation[] | null;
}

export interface CalcomExport {
  event_types?: CalcomEventType[];
}

export interface MappedEventType {
  title: string;
  slug: string;
  durationMinutes: number;
  description: string | null;
  location: LocationTypeValue;
  locationDetail: string | null;
  requiresConfirmation: boolean;
  minimumNoticeMinutes: number;
  isPrivate: boolean;
}

const LOCATION_TYPES_NEEDING_DETAIL = new Set<LocationTypeValue>([
  "zoom",
  "phone",
  "in_person",
  "custom",
]);

/**
 * Map one Cal.com location entry to a DayOtter location type + optional detail.
 * Cal.com namespaces integration locations (`integrations:<vendor>[:<kind>]`) and
 * uses bare keys for the rest. Anything unrecognized falls back to `custom`.
 */
export function mapLocation(loc: CalcomLocation | undefined): {
  location: LocationTypeValue;
  locationDetail: string | null;
} {
  const type = (loc?.type ?? "").toLowerCase();
  const detailFrom = (v?: string | null) => (v?.trim() ? v.trim() : null);

  if (type.includes("google")) return { location: "google_meet", locationDetail: null };
  if (type.includes("office365") || type.includes("msteams") || type.includes("teams"))
    return { location: "ms_teams", locationDetail: null };
  if (type.includes("zoom")) return { location: "zoom", locationDetail: detailFrom(loc?.link) };
  if (type.includes("daily") || type.includes("jitsi") || type.includes("whereby"))
    return { location: "jitsi", locationDetail: null };
  if (type === "inperson" || type.includes("inperson"))
    return { location: "in_person", locationDetail: detailFrom(loc?.address) };
  if (type.includes("phone"))
    return { location: "phone", locationDetail: detailFrom(loc?.hostPhoneNumber) };
  if (type === "link" || type.includes("link"))
    return { location: "custom", locationDetail: detailFrom(loc?.link) };
  // google_meet is a safe, detail-free default for anything we don't recognize.
  return { location: "google_meet", locationDetail: null };
}

function slugify(v: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "meeting"
  );
}

/** Map a single Cal.com event type. Returns null for entries too malformed to import. */
export function mapEventType(et: CalcomEventType): MappedEventType | null {
  const title = (et.title ?? "").trim();
  if (!title) return null;
  const duration = Number.isFinite(et.length) && (et.length ?? 0) > 0 ? Math.round(et.length!) : 30;
  const first = et.locations?.find((l) => l?.type) ?? et.locations?.[0];
  const { location, locationDetail } = mapLocation(first);
  return {
    title: title.slice(0, 120),
    slug: slugify(et.slug?.trim() || title),
    durationMinutes: Math.min(480, Math.max(5, duration)),
    description: et.description?.trim() ? et.description.trim().slice(0, 2000) : null,
    location,
    // Only keep a detail for location types that use one.
    locationDetail: LOCATION_TYPES_NEEDING_DETAIL.has(location) ? locationDetail : null,
    requiresConfirmation: Boolean(et.requiresConfirmation),
    minimumNoticeMinutes:
      Number.isFinite(et.minimumBookingNotice) && (et.minimumBookingNotice ?? 0) >= 0
        ? Math.min(43_200, Math.round(et.minimumBookingNotice!))
        : 60,
    isPrivate: Boolean(et.hidden),
  };
}

/** Map a full Cal.com export to DayOtter event types, dropping malformed entries. */
export function mapCalcomExport(data: CalcomExport): MappedEventType[] {
  return (data.event_types ?? []).map(mapEventType).filter((x): x is MappedEventType => x !== null);
}
