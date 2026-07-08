import { z } from "zod";

/** Location / meeting types a host can pick for an event type. */
export const LOCATION_TYPES = [
  "google_meet",
  "ms_teams",
  "zoom",
  "phone",
  "in_person",
  "custom",
] as const;

export type LocationTypeValue = (typeof LOCATION_TYPES)[number];

/** Location types that auto-generate a conference link (no detail needed). */
export const AUTO_CONFERENCE: LocationTypeValue[] = ["google_meet", "ms_teams"];

/** Location types where the host must supply a detail (link / number / address). */
export const NEEDS_DETAIL: LocationTypeValue[] = ["zoom", "phone", "in_person", "custom"];

export const LOCATION_LABELS: Record<LocationTypeValue, string> = {
  google_meet: "Google Meet",
  ms_teams: "Microsoft Teams",
  zoom: "Zoom",
  phone: "Phone call",
  in_person: "In person",
  custom: "Custom",
};

export const LOCATION_DETAIL_PLACEHOLDER: Record<LocationTypeValue, string> = {
  google_meet: "",
  ms_teams: "",
  zoom: "https://zoom.us/j/…",
  phone: "+1 555 123 4567 (or 'I'll call you')",
  in_person: "123 Main St, or a place to meet",
  custom: "How and where to meet",
};

/**
 * The full editable field set for an event type — shared by the create (`POST`)
 * and update (`PUT`) API routes and the client form so validation stays in one
 * place. Every field maps directly to a column the availability engine already
 * honours (buffers, minimum notice, booking window).
 */
/** Field types a host can add to an event type's intake form. */
export const QUESTION_TYPES = ["text", "textarea", "email", "phone", "select", "checkbox"] as const;

export const QUESTION_TYPE_LABELS: Record<(typeof QUESTION_TYPES)[number], string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone",
  select: "Dropdown",
  checkbox: "Checkbox",
};

export const bookingQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  type: z.enum(QUESTION_TYPES),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(120)).max(20).optional(),
});

export type BookingQuestionInput = z.infer<typeof bookingQuestionSchema>;

export const eventTypeInputSchema = z
  .object({
    title: z.string().min(1).max(120),
    slug: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and dashes only"),
    durationMinutes: z.number().int().min(5).max(480),
    description: z.string().max(2000).optional(),
    location: z.enum(LOCATION_TYPES).default("google_meet"),
    locationDetail: z.string().max(500).optional(),
    bufferBeforeMinutes: z.number().int().min(0).max(240).default(0),
    bufferAfterMinutes: z.number().int().min(0).max(240).default(0),
    // 0 = no minimum; capped at 30 days.
    minimumNoticeMinutes: z.number().int().min(0).max(43_200).default(60),
    bookingWindowDays: z.number().int().min(1).max(730).default(60),
    /** Cap confirmed bookings per day (null = unlimited). */
    dailyBookingLimit: z.number().int().min(1).max(100).nullable().default(null),
    /** Hidden from the public profile listing (still bookable by direct link). */
    isPrivate: z.boolean().default(false),
    /** Send the booker here after booking instead of the calSync confirmation. */
    redirectUrl: z.string().url().max(500).nullable().default(null),
    questions: z.array(bookingQuestionSchema).max(20).default([]),
  })
  .refine(
    (d) =>
      !NEEDS_DETAIL.includes(d.location) ||
      Boolean(d.locationDetail && d.locationDetail.trim().length > 0),
    { message: "Add the details for this location type", path: ["locationDetail"] },
  );

export type EventTypeInput = z.infer<typeof eventTypeInputSchema>;
