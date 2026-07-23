import { notPersonalType } from "@/lib/booking/personal-event-type";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { mapEventType, mapSchedule, shouldImportEventType } from "./calendly";
import type { RawCalendlyExport } from "./calendly-client";

export interface ImportSummary {
  /** Display name of the imported Calendly account. */
  account: string;
  eventTypesImported: number;
  eventTypesSkipped: number;
  schedulesImported: number;
  rulesImported: number;
  /** Human-readable notes about anything that wasn't a clean 1:1 import. */
  warnings: string[];
}

/** Suffix a slug until it's unique among the already-taken set. */
function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 56)}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 50)}-${Date.now()}`;
}

/**
 * Persist a fetched Calendly export into the user's DayOtter workspace: recreate
 * their availability schedules and event types. Idempotent-ish - re-running
 * imports again under de-duplicated slugs rather than overwriting, so it never
 * clobbers existing DayOtter data (imported schedules are added, never made the
 * default; event types with a colliding slug get a `-2` suffix).
 */
export async function importCalendlyExport(
  userId: string,
  data: RawCalendlyExport,
): Promise<ImportSummary> {
  const db = getDb();
  const { organizationId, scheduleId: defaultScheduleId } = await ensureUserWorkspace(userId);

  const warnings: string[] = [];

  // 1. Availability schedules (only those with real weekly rules). We add them
  //    as named schedules and never flip the user's existing default.
  let schedulesImported = 0;
  let rulesImported = 0;
  let importedDefaultScheduleId: string | null = null;

  for (const raw of data.schedules) {
    const mapped = mapSchedule(raw);
    if (mapped.rules.length === 0) continue;
    const [created] = await db
      .insert(schema.schedules)
      .values({
        userId,
        name: mapped.name,
        timezone: mapped.timezone,
        isDefault: false,
      })
      .returning();
    if (!created) continue;
    await db.insert(schema.availabilityRules).values(
      mapped.rules.map((r) => ({
        scheduleId: created.id,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    );
    schedulesImported++;
    rulesImported += mapped.rules.length;
    if (mapped.isDefault && !importedDefaultScheduleId) importedDefaultScheduleId = created.id;
  }

  // Event types point at the imported "default" schedule when we recreated one,
  // so bookings honour the availability the user actually had on Calendly;
  // otherwise they fall back to the DayOtter default schedule.
  const targetScheduleId = importedDefaultScheduleId ?? defaultScheduleId;

  // 2. Event types. Dedupe slugs against the user's existing ones + this run.
  const existing = await db.query.eventTypes.findMany({
    where: and(eq(schema.eventTypes.ownerId, userId), notPersonalType),
    columns: { slug: true },
  });
  const takenSlugs = new Set(existing.map((e) => e.slug));

  let eventTypesImported = 0;
  let eventTypesSkipped = 0;

  for (const raw of data.eventTypes) {
    if (!shouldImportEventType(raw)) {
      eventTypesSkipped++;
      continue;
    }
    const m = mapEventType(raw);
    const slug = uniqueSlug(m.slug, takenSlugs);
    takenSlugs.add(slug);

    if (raw.pooling_type) {
      warnings.push(
        `"${m.title}" was a Calendly team event - imported as a personal event type you host.`,
      );
    }

    try {
      await db.insert(schema.eventTypes).values({
        organizationId,
        ownerId: userId,
        scheduleId: targetScheduleId,
        title: m.title,
        slug,
        durationMinutes: m.durationMinutes,
        description: m.description,
        location: m.location,
        locationDetail: m.locationDetail,
        color: m.color,
        isActive: m.isActive,
        isPrivate: m.isPrivate,
        questions: m.questions,
      });
      eventTypesImported++;
    } catch (err) {
      eventTypesSkipped++;
      logger.error("calendly event type import failed", {
        event: "calendly_import_event_type_failed",
        title: m.title,
        err,
      });
    }
  }

  logger.info("calendly import complete", {
    event: "calendly_import_complete",
    userId,
    eventTypesImported,
    schedulesImported,
  });

  return {
    account: data.user.name || "your Calendly account",
    eventTypesImported,
    eventTypesSkipped,
    schedulesImported,
    rulesImported,
    warnings,
  };
}
