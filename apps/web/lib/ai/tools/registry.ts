import { z } from "zod";

/**
 * The DayOtter AI tool registry. Declarative definitions the chat assistant can
 * call to READ and CONTROL the app. This module is isomorphic (no server-only
 * imports) so the descriptions/schemas can be shared; execution lives in
 * `./exec` (server-only).
 *
 * Policy (see `confirmLevel`):
 *  - read       → runs immediately, result fed back to the model.
 *  - write      → confirm-first: the model proposes, the user taps Confirm, then
 *                 it executes via /api/ai/act. Nothing changes without a click.
 *  - destructive→ same, but the user's request is honored ONLY behind an explicit
 *                 danger confirmation (deleting always requires confirmation).
 *
 * Bookings (create / reschedule / cancel) are handled by the older
 * `propose_action` tool in ../chat.ts (they need rich date-editable cards); this
 * registry covers everything else — booking types, availability, preferences,
 * focus blocks, channels, teams.
 */
export type ToolKind = "read" | "write" | "destructive";
export type ConfirmLevel = "none" | "confirm" | "danger";

export interface AiToolDef {
  name: string;
  description: string;
  kind: ToolKind;
  confirmLevel: ConfirmLevel;
  /** JSON Schema handed to the model. */
  schema: Record<string, unknown>;
  /** Zod validation of the model's input (defense in depth at execution time). */
  zod: z.ZodTypeAny;
  /** Card title shown on the confirm card (action tools only). */
  title: string;
  /** One-line human summary of what confirming will do. */
  summarize: (input: Record<string, unknown>) => string;
}

const empty = { type: "object", additionalProperties: false, properties: {} } as const;

const LOCATIONS = ["google_meet", "ms_teams", "zoom", "phone", "in_person", "custom"] as const;
const COLORS = ["violet", "mint", "amber", "coral", "sky"] as const;

export const TOOLS: AiToolDef[] = [
  // ---- Reads (run immediately) ----
  {
    name: "list_booking_types",
    description:
      "List the host's booking types (event types): title, slug, duration, active state, and public URL.",
    kind: "read",
    confirmLevel: "none",
    schema: empty,
    zod: z.object({}),
    title: "Booking types",
    summarize: () => "List booking types",
  },
  {
    name: "get_availability",
    description:
      "Get the host's default availability schedule: timezone, weekly working hours per day, and date overrides.",
    kind: "read",
    confirmLevel: "none",
    schema: empty,
    zod: z.object({}),
    title: "Availability",
    summarize: () => "Read availability",
  },
  {
    name: "get_preferences",
    description:
      "Get the host's scheduling preferences (time format, week start, theme, reminder offsets, lunch, travel buffer, adaptive availability, max meetings/day).",
    kind: "read",
    confirmLevel: "none",
    schema: empty,
    zod: z.object({}),
    title: "Preferences",
    summarize: () => "Read preferences",
  },
  {
    name: "list_focus_blocks",
    description:
      "List the host's upcoming focus / personal time blocks that hold time on the calendar.",
    kind: "read",
    confirmLevel: "none",
    schema: empty,
    zod: z.object({}),
    title: "Focus blocks",
    summarize: () => "List focus blocks",
  },
  {
    name: "list_notification_channels",
    description:
      "List the host's reminder notification channels (Slack, SMS, WhatsApp, push, browser) with masked destinations.",
    kind: "read",
    confirmLevel: "none",
    schema: empty,
    zod: z.object({}),
    title: "Channels",
    summarize: () => "List channels",
  },

  // ---- Writes (confirm-first) ----
  {
    name: "create_booking_type",
    description:
      "Create a new booking type (event type) the host can share. Requires title, a URL slug (lowercase, hyphenated), and a duration in minutes. Confirm-first.",
    kind: "write",
    confirmLevel: "confirm",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Display name, e.g. 'Intro call'." },
        slug: { type: "string", description: "URL slug: lowercase letters, numbers, hyphens." },
        durationMinutes: { type: "integer", description: "Meeting length, 5–480." },
        description: {
          type: "string",
          description: "Optional description shown on the booking page.",
        },
        location: { type: "string", enum: LOCATIONS as unknown as string[] },
        color: { type: "string", enum: COLORS as unknown as string[] },
      },
      required: ["title", "slug", "durationMinutes"],
    },
    zod: z.object({
      title: z.string().min(1).max(120),
      slug: z
        .string()
        .min(1)
        .max(60)
        .regex(/^[a-z0-9-]+$/),
      durationMinutes: z.number().int().min(5).max(480),
      description: z.string().max(2000).optional(),
      location: z.enum(LOCATIONS).optional(),
      color: z.enum(COLORS).optional(),
    }),
    title: "Create booking type",
    summarize: (i) => `Create “${i.title}” (${i.durationMinutes} min) at /${i.slug}`,
  },
  {
    name: "create_focus_block",
    description:
      "Reserve a focus / personal time block that blocks bookable availability. Give a title, a start time (ISO-8601), and a duration in minutes.",
    kind: "write",
    confirmLevel: "confirm",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        startISO: { type: "string", description: "ISO-8601 start instant." },
        durationMinutes: { type: "integer", description: "15–480." },
        kind: { type: "string", enum: ["focus", "personal", "travel", "other"] },
        timezone: { type: "string", description: "IANA timezone (defaults to the host's)." },
      },
      required: ["title", "startISO", "durationMinutes"],
    },
    zod: z.object({
      title: z.string().min(1).max(120),
      startISO: z.string().datetime(),
      durationMinutes: z.number().int().min(15).max(480),
      kind: z.enum(["focus", "personal", "travel", "other"]).optional(),
      timezone: z.string().min(1).max(64).optional(),
    }),
    title: "Hold focus time",
    summarize: (i) => `Block ${i.durationMinutes} min for “${i.title}”`,
  },
  {
    name: "update_preferences",
    description:
      "Update one or more scheduling preferences. Only the fields you pass change; the rest are preserved. Use get_preferences first if unsure of current values.",
    kind: "write",
    confirmLevel: "confirm",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeFormat: { type: "string", enum: ["12h", "24h"] },
        weekStartsOn: { type: "integer", description: "0=Sunday … 6=Saturday." },
        theme: { type: "string", enum: ["system", "light", "dark"] },
        adaptiveAvailability: { type: "boolean" },
        maxMeetingsPerDay: { type: "integer", description: "1–20." },
        travelBufferMinutes: { type: "integer", description: "0–240." },
        reclaimCancelledTime: { type: "boolean" },
        lunchEnabled: { type: "boolean" },
        lunchStartMinute: {
          type: "integer",
          description: "Minutes from midnight, e.g. 720 = 12:00.",
        },
        lunchEndMinute: { type: "integer" },
      },
    },
    zod: z.object({
      timeFormat: z.enum(["12h", "24h"]).optional(),
      weekStartsOn: z.number().int().min(0).max(6).optional(),
      theme: z.enum(["system", "light", "dark"]).optional(),
      adaptiveAvailability: z.boolean().optional(),
      maxMeetingsPerDay: z.number().int().min(1).max(20).optional(),
      travelBufferMinutes: z.number().int().min(0).max(240).optional(),
      reclaimCancelledTime: z.boolean().optional(),
      lunchEnabled: z.boolean().optional(),
      lunchStartMinute: z.number().int().min(0).max(1439).optional(),
      lunchEndMinute: z.number().int().min(1).max(1440).optional(),
    }),
    title: "Update preferences",
    summarize: (i) => `Update ${Object.keys(i).join(", ")}`,
  },
  {
    name: "set_weekly_hours",
    description:
      "Replace the host's weekly working hours (and optionally timezone). Pass every working day you want; days you omit become unavailable. Date overrides are preserved. Read get_availability first so you don't drop hours the host wants to keep.",
    kind: "write",
    confirmLevel: "confirm",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        timezone: { type: "string", description: "IANA timezone; omit to keep current." },
        days: {
          type: "array",
          description: "Working days and their time ranges.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              dayOfWeek: { type: "integer", description: "0=Sunday … 6=Saturday." },
              ranges: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    start: { type: "string", description: "HH:MM 24h." },
                    end: { type: "string", description: "HH:MM 24h." },
                  },
                  required: ["start", "end"],
                },
              },
            },
            required: ["dayOfWeek", "ranges"],
          },
        },
      },
      required: ["days"],
    },
    zod: z.object({
      timezone: z.string().min(1).max(64).optional(),
      days: z
        .array(
          z.object({
            dayOfWeek: z.number().int().min(0).max(6),
            ranges: z.array(
              z.object({
                start: z.string().regex(/^\d{2}:\d{2}$/),
                end: z.string().regex(/^\d{2}:\d{2}$/),
              }),
            ),
          }),
        )
        .max(7),
    }),
    title: "Update working hours",
    summarize: (i) => `Set working hours for ${(i.days as unknown[])?.length ?? 0} day(s)`,
  },

  // ---- Destructive (danger confirm; deleting ALWAYS requires confirmation) ----
  {
    name: "delete_booking_type",
    description:
      "Delete a booking type by id. If it has bookings it is archived (deactivated) instead of hard-deleted. Destructive — requires explicit confirmation.",
    kind: "destructive",
    confirmLevel: "danger",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", description: "Booking type id (from list_booking_types)." },
      },
      required: ["id"],
    },
    zod: z.object({ id: z.string().uuid() }),
    title: "Delete booking type",
    summarize: () => "Delete this booking type (archived if it has bookings)",
  },
  {
    name: "delete_focus_block",
    description:
      "Delete a focus / personal time block by id. Pass series=true to delete the whole recurring series. Destructive — requires explicit confirmation.",
    kind: "destructive",
    confirmLevel: "danger",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", description: "Time block id (from list_focus_blocks)." },
        series: { type: "boolean", description: "Delete the entire recurring series." },
      },
      required: ["id"],
    },
    zod: z.object({ id: z.string().uuid(), series: z.boolean().optional() }),
    title: "Delete focus block",
    summarize: (i) => (i.series ? "Delete this recurring focus series" : "Delete this focus block"),
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
export function getTool(name: string): AiToolDef | undefined {
  return BY_NAME.get(name);
}
export const READ_TOOLS = TOOLS.filter((t) => t.kind === "read");
export const ACTION_TOOLS = TOOLS.filter((t) => t.kind !== "read");

/** Anthropic tool definitions for every registry tool. */
export function anthropicToolDefs() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema,
  }));
}
