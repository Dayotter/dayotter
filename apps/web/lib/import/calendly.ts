import {
  type BookingQuestionInput,
  type LocationTypeValue,
  NEEDS_DETAIL,
  type QUESTION_TYPES,
} from "../booking/event-type-input";

/**
 * Pure mapping layer: Calendly API v2 shapes → the fields DayOtter stores. Kept
 * free of any network / DB access so it can be exhaustively unit-tested; the
 * client (`calendly-client.ts`) and the persistence layer (`run-import.ts`)
 * wrap it. Only the subset of Calendly's payload we actually use is typed.
 */

// ---------------------------------------------------------------------------
// Calendly payload shapes (partial)
// ---------------------------------------------------------------------------

export interface CalendlyLocation {
  kind?: string;
  /** Physical address / custom text location. */
  location?: string | null;
  join_url?: string | null;
  phone_number?: string | null;
  additional_info?: string | null;
}

export interface CalendlyCustomQuestion {
  name: string;
  /** "string" | "text" | "phone_number" | "single_select" | "multi_select" */
  type: string;
  position?: number;
  enabled?: boolean;
  required?: boolean;
  answer_choices?: string[] | null;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active?: boolean;
  slug?: string | null;
  duration: number;
  /** "solo" | "group" */
  kind?: string | null;
  /** null | "round_robin" | "collective" - set for team events. */
  pooling_type?: string | null;
  /** "StandardEventType" | "AdhocEventType" */
  type?: string | null;
  color?: string | null;
  description_plain?: string | null;
  secret?: boolean;
  deleted_at?: string | null;
  locations?: CalendlyLocation[] | null;
  custom_questions?: CalendlyCustomQuestion[] | null;
}

export interface CalendlyAvailabilityRule {
  /** "wday" | "date" */
  type: string;
  /** For wday rules: "sunday" .. "saturday". */
  wday?: string;
  /** For date rules: "YYYY-MM-DD". */
  date?: string;
  intervals?: { from: string; to: string }[];
}

export interface CalendlyAvailabilitySchedule {
  uri: string;
  name?: string | null;
  default?: boolean;
  timezone?: string | null;
  rules?: CalendlyAvailabilityRule[] | null;
}

// ---------------------------------------------------------------------------
// Mapped (DayOtter-shaped) results
// ---------------------------------------------------------------------------

export interface MappedEventType {
  title: string;
  slug: string;
  durationMinutes: number;
  description?: string;
  location: LocationTypeValue;
  locationDetail?: string;
  color: string | null;
  isActive: boolean;
  isPrivate: boolean;
  questions: BookingQuestionInput[];
}

export interface MappedRule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface MappedSchedule {
  name: string;
  timezone: string;
  isDefault: boolean;
  rules: MappedRule[];
}

// ---------------------------------------------------------------------------
// Field mappers
// ---------------------------------------------------------------------------

/** Slugify to our `^[a-z0-9-]+$` (max 60), never empty. */
export function toEventSlug(input: string | null | undefined): string {
  const s = (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "event";
}

const WDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Bucket a Calendly hex colour into one of our five colour tokens by hue, so
 * imported event types keep some visual variety. Unknown / invalid → null (the
 * app then renders the default). Pure and deterministic.
 */
export function hexToColorToken(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = Number.parseInt(m[1]!, 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 12) return null; // near-grey: no meaningful hue
  let h: number;
  if (max === r) h = (((g - b) / d) % 6) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  if (h < 0) h += 360;
  // Hue buckets → tokens (violet/mint/amber/coral/sky).
  if (h < 45 || h >= 320) return "coral";
  if (h < 70) return "amber";
  if (h < 170) return "mint";
  if (h < 250) return "sky";
  return "violet";
}

/** Map Calendly's location list to our (location, detail). Falls back to a safe,
 *  non-empty detail for detail-requiring types so the imported record is valid. */
export function mapLocation(locations: CalendlyLocation[] | null | undefined): {
  location: LocationTypeValue;
  locationDetail?: string;
} {
  const loc = locations?.[0];
  const kind = loc?.kind ?? "";
  let location: LocationTypeValue;
  let detail: string | undefined;

  switch (kind) {
    case "google_conference":
      location = "google_meet";
      break;
    case "microsoft_teams_conference":
      location = "ms_teams";
      break;
    case "zoom_conference":
      location = "zoom";
      detail = loc?.join_url ?? loc?.location ?? undefined;
      break;
    case "physical":
    case "custom":
      location = kind === "physical" ? "in_person" : "custom";
      detail = loc?.location ?? loc?.additional_info ?? undefined;
      break;
    case "outbound_call":
      location = "phone";
      detail = "The host will call you.";
      break;
    case "inbound_call":
      location = "phone";
      detail = loc?.phone_number ?? "Call the host.";
      break;
    case "ask_invitee":
      location = "phone";
      detail = "You'll provide a number when booking.";
      break;
    case "gotomeeting_conference":
    case "webex_conference":
      location = "custom";
      detail = loc?.join_url ?? loc?.location ?? kind.replace(/_/g, " ");
      break;
    default:
      // No/unknown location → our default auto-conference type.
      location = "google_meet";
  }

  // Detail-requiring types must carry a non-empty detail to stay editable.
  if (NEEDS_DETAIL.includes(location) && !detail?.trim()) {
    detail =
      location === "zoom"
        ? "Add your Zoom link"
        : location === "in_person"
          ? "Location to be confirmed"
          : location === "phone"
            ? "Phone details to be confirmed"
            : "Details to be confirmed";
  }
  return { location, locationDetail: detail };
}

const QUESTION_TYPE_MAP: Record<string, (typeof QUESTION_TYPES)[number]> = {
  string: "text",
  text: "textarea",
  phone_number: "phone",
  single_select: "select",
  multi_select: "select",
};

/** Map Calendly custom questions to our booking-question shape (max 20). */
export function mapQuestions(
  questions: CalendlyCustomQuestion[] | null | undefined,
): BookingQuestionInput[] {
  if (!questions) return [];
  const out: BookingQuestionInput[] = [];
  for (const q of questions) {
    if (q.enabled === false) continue;
    const type = QUESTION_TYPE_MAP[q.type] ?? "text";
    const label = (q.name ?? "").trim().slice(0, 200);
    if (!label) continue;
    const options =
      type === "select"
        ? (q.answer_choices ?? [])
            .map((c) => c.slice(0, 120))
            .filter(Boolean)
            .slice(0, 20)
        : undefined;
    out.push({
      id: `q${out.length + 1}`,
      label,
      type,
      required: Boolean(q.required),
      ...(options && options.length > 0 ? { options } : {}),
    });
    if (out.length >= 20) break;
  }
  return out;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** True when a Calendly event type is worth importing (skip ad-hoc / deleted). */
export function shouldImportEventType(et: CalendlyEventType): boolean {
  if (et.deleted_at) return false;
  if (et.type === "AdhocEventType") return false;
  return true;
}

/** Map a Calendly event type to our event-type insert fields. */
export function mapEventType(et: CalendlyEventType): MappedEventType {
  const { location, locationDetail } = mapLocation(et.locations);
  const description = et.description_plain?.trim().slice(0, 2000) || undefined;
  return {
    title: (et.name ?? "Untitled").trim().slice(0, 120) || "Untitled",
    slug: toEventSlug(et.slug || et.name),
    durationMinutes: clamp(Math.round(et.duration ?? 30), 5, 480),
    description,
    location,
    locationDetail,
    color: hexToColorToken(et.color),
    isActive: et.active !== false,
    isPrivate: Boolean(et.secret),
    questions: mapQuestions(et.custom_questions),
  };
}

/** Map a Calendly availability schedule's weekly (wday) rules to our rules. Date
 *  overrides are skipped in this first version. */
export function mapScheduleRules(
  rules: CalendlyAvailabilityRule[] | null | undefined,
): MappedRule[] {
  const out: MappedRule[] = [];
  for (const rule of rules ?? []) {
    if (rule.type !== "wday" || rule.wday == null) continue;
    const dayOfWeek = WDAY[rule.wday.toLowerCase()];
    if (dayOfWeek == null) continue;
    for (const interval of rule.intervals ?? []) {
      const startTime = toTime(interval.from);
      const endTime = toTime(interval.to);
      if (startTime && endTime) out.push({ dayOfWeek, startTime, endTime });
    }
  }
  return out;
}

/** Normalise a Calendly "HH:MM" (or "HH:MM:SS") to our "HH:MM:SS" time literal. */
function toTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = String(Math.min(23, Number(m[1]))).padStart(2, "0");
  return `${h}:${m[2]}:${m[3] ?? "00"}`;
}

/** Map a Calendly availability schedule to our schedule + rules shape. */
export function mapSchedule(s: CalendlyAvailabilitySchedule): MappedSchedule {
  return {
    name: (s.name ?? "Imported schedule").trim().slice(0, 80) || "Imported schedule",
    timezone: s.timezone?.trim() || "UTC",
    isDefault: Boolean(s.default),
    rules: mapScheduleRules(s.rules),
  };
}
