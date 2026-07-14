import { notPersonalType } from "@/lib/booking/personal-event-type";
import { and, eq, getDb, schema } from "@dayotter/db";

export interface VoiceHost {
  userId: string;
  name: string;
  handle: string | null;
  timezone: string;
  bookingUrl: string | null;
}

/**
 * A knowledge source contributes lines the receptionist can ground its answers
 * in. This is the extension point — add a source (e.g. a custom FAQ table, hours,
 * pricing) and the receptionist can answer from it. Return [] when nothing.
 */
export interface KnowledgeSource {
  key: string;
  gather(host: VoiceHost): Promise<string[]>;
}

/** Built-in sources. Keep them cheap and grounded (never invent). */
export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  // What the host offers — their bookable services.
  {
    key: "services",
    async gather(host) {
      const types = await getDb().query.eventTypes.findMany({
        where: and(
          eq(schema.eventTypes.ownerId, host.userId),
          eq(schema.eventTypes.isActive, true),
          notPersonalType,
        ),
        columns: { title: true, durationMinutes: true, description: true },
      });
      if (types.length === 0) return [];
      return [
        "Services offered:",
        ...types.map(
          (t) =>
            `- ${t.title} (${t.durationMinutes} min)${t.description ? `: ${t.description}` : ""}`,
        ),
      ];
    },
  },
  // The host's own welcome / bio blurb, if set.
  {
    key: "welcome",
    async gather(host) {
      const prefs = await getDb().query.userPreferences.findFirst({
        where: eq(schema.userPreferences.userId, host.userId),
        columns: { welcomeMessage: true },
      });
      return prefs?.welcomeMessage ? [`About: ${prefs.welcomeMessage}`] : [];
    },
  },
  // How to actually book.
  {
    key: "booking",
    async gather(host) {
      return host.bookingUrl
        ? [`To book, visit ${host.bookingUrl} — the receptionist can also text this link.`]
        : [];
    },
  },
];

/** Assemble the grounded knowledge block for the receptionist prompt. */
export async function buildKnowledge(host: VoiceHost): Promise<string> {
  const chunks = await Promise.all(KNOWLEDGE_SOURCES.map((s) => s.gather(host)));
  return chunks.flat().filter(Boolean).join("\n").trim();
}
