import { randomUUID } from "node:crypto";
import { searchKnowledge } from "@/lib/ai/catalogue";
import { computeAnalytics } from "@/lib/booking/analytics";
import { cancelBooking, cancelBookingSeries } from "@/lib/booking/cancel-booking";
import { eventTypeInputSchema } from "@/lib/booking/event-type-input";
import { findFocusBlocks } from "@/lib/booking/focus-suggestions";
import { notPersonalType } from "@/lib/booking/personal-event-type";
import { rescheduleBooking } from "@/lib/booking/reschedule-booking";
import { resolveScheduleId } from "@/lib/booking/schedule";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { getAgenda } from "@/lib/calendar/agenda";
import { type BusyItem, analyzeSchedule } from "@/lib/calendar/analyze";
import { updateBookingCalendarEvent } from "@/lib/calendar/host-calendar";
import { recurringBlockOccurrences } from "@/lib/calendar/recurrence";
import {
  channelInputSchema,
  configFromInput,
  maskChannel,
} from "@/lib/notifications/channel-input";
import { listOutOfOffice, listTeammates } from "@/lib/out-of-office";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  DEFAULT_REMINDER_OFFSETS,
  decryptJson,
  encryptJson,
  logger,
  sha256hex,
} from "@dayotter/core";
import { and, asc, desc, eq, getDb, gte, inArray, lte, ne, schema } from "@dayotter/db";
import { availableChannels, dispatchToChannel } from "@dayotter/notifications";
import type { ChannelConfig, DeliverableChannel } from "@dayotter/notifications";
import { DateTime } from "luxon";
import { getTool } from "./registry";

/**
 * Server-only execution for the AI tool registry. Reads run inline in the chat
 * loop; actions run here from /api/ai/act AFTER the user confirms. Each executor
 * reuses the same DB writes and validation as the corresponding UI route, so the
 * assistant can never do anything the app itself couldn't.
 */

/** Run a read tool and return a compact JSON string for the model. */
export async function executeReadTool(
  userId: string,
  name: string,
  input?: Record<string, unknown>,
): Promise<string> {
  const db = getDb();
  switch (name) {
    case "get_agenda": {
      const now = new Date();
      const fromRaw = input?.fromISO ? new Date(input.fromISO as string) : now;
      const from = Number.isNaN(fromRaw.getTime()) ? now : fromRaw;
      const toRaw = input?.toISO ? new Date(input.toISO as string) : null;
      const to =
        toRaw && !Number.isNaN(toRaw.getTime()) && toRaw > from
          ? toRaw
          : new Date(from.getTime() + 7 * 86_400_000);
      const items = await getAgenda(userId, from, to, 100);
      return JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
        count: items.length,
        items: items.map((i) => ({
          title: i.title,
          startsAt: i.startsAt.toISOString(),
          endsAt: i.endsAt.toISOString(),
          source: i.source,
          ...(i.attendees.length ? { attendees: i.attendees } : {}),
        })),
        note: items.length
          ? "'booking' = a DayOtter booking (can be rescheduled/cancelled); 'external' = a synced calendar event (read-only)."
          : "Nothing scheduled in that window - the host is free.",
      });
    }
    case "search_bookings": {
      const q = ((input?.query as string) ?? "").trim().toLowerCase();
      const includePast = input?.includePast === true;
      const now = new Date();
      const fromRaw = input?.fromISO ? new Date(input.fromISO as string) : null;
      const toRaw = input?.toISO ? new Date(input.toISO as string) : null;
      const from = fromRaw && !Number.isNaN(fromRaw.getTime()) ? fromRaw : includePast ? null : now;
      const to = toRaw && !Number.isNaN(toRaw.getTime()) ? toRaw : null;
      const conds = [eq(schema.bookings.hostId, userId), ne(schema.bookings.status, "cancelled")];
      if (from) conds.push(gte(schema.bookings.startsAt, from));
      if (to) conds.push(lte(schema.bookings.startsAt, to));
      const rows = await db.query.bookings.findMany({
        where: and(...conds),
        orderBy: includePast ? desc(schema.bookings.startsAt) : asc(schema.bookings.startsAt),
        limit: q ? 200 : 40,
        with: { attendees: { columns: { name: true, email: true } } },
      });
      const matched = rows
        .filter((b) => {
          if (!q) return true;
          const hay =
            `${b.title} ${b.attendees.map((a) => `${a.name ?? ""} ${a.email}`).join(" ")}`.toLowerCase();
          return hay.includes(q);
        })
        .slice(0, 25)
        .map((b) => ({
          uid: b.uid,
          title: b.title,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          status: b.status,
          attendees: b.attendees.map((a) => a.name ?? a.email),
        }));
      return JSON.stringify({ count: matched.length, bookings: matched });
    }
    case "analyze_schedule": {
      const from = new Date(input?.fromISO as string);
      const to = new Date(input?.toISO as string);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        return JSON.stringify({ error: "Pass a valid fromISO/toISO window (to after from)." });
      }
      const [agenda, focus, user] = await Promise.all([
        getAgenda(userId, from, to, 200),
        db.query.timeBlocks.findMany({
          where: and(
            eq(schema.timeBlocks.userId, userId),
            gte(schema.timeBlocks.endsAt, from),
            lte(schema.timeBlocks.startsAt, to),
          ),
          columns: { title: true, kind: true, startsAt: true, endsAt: true },
        }),
        db.query.users.findFirst({
          where: eq(schema.users.id, userId),
          columns: { timezone: true },
        }),
      ]);
      const items: BusyItem[] = [
        ...agenda.map((i) => ({
          title: i.title,
          startsAt: i.startsAt,
          endsAt: i.endsAt,
          source: i.source,
        })),
        ...focus.map((f) => ({
          title: f.title,
          startsAt: f.startsAt,
          endsAt: f.endsAt,
          source: f.kind,
        })),
      ];
      const analysis = analyzeSchedule(items, from, to, user?.timezone ?? "UTC");
      return JSON.stringify({
        ...analysis,
        note: "busyHours merges overlaps (double-booked time counted once). 'finish time' = lastEndISO. For bookable openings that respect working hours, use find_free_slots.",
      });
    }
    case "check_availability": {
      const from = new Date(input?.fromISO as string);
      const to = new Date(input?.toISO as string);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        return JSON.stringify({ error: "Pass a valid fromISO/toISO window (to after from)." });
      }
      const [agenda, focus] = await Promise.all([
        // Bookings + synced external calendar events, already merged.
        getAgenda(userId, from, to, 100),
        // Held focus / personal blocks (not part of getAgenda) also make the host busy.
        db.query.timeBlocks.findMany({
          where: and(
            eq(schema.timeBlocks.userId, userId),
            gte(schema.timeBlocks.endsAt, from),
            lte(schema.timeBlocks.startsAt, to),
          ),
          columns: { title: true, kind: true, startsAt: true, endsAt: true },
        }),
      ]);
      const conflicts = [
        ...agenda.map((i) => ({
          title: i.title,
          source: i.source,
          startsAt: i.startsAt.toISOString(),
          endsAt: i.endsAt.toISOString(),
        })),
        ...focus.map((f) => ({
          title: f.title,
          source: f.kind,
          startsAt: f.startsAt.toISOString(),
          endsAt: f.endsAt.toISOString(),
        })),
      ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
        free: conflicts.length === 0,
        conflicts,
        note:
          conflicts.length === 0
            ? "Nothing is on the calendar in that window. (This reflects existing commitments, not working hours - use find_free_slots for bookable openings.)"
            : "These commitments overlap the window, so the host is not fully free.",
      });
    }
    case "list_out_of_office": {
      const periods = await listOutOfOffice(userId);
      return JSON.stringify(
        periods.map((p) => ({
          id: p.id,
          startDate: p.startDate,
          endDate: p.endDate,
          reason: p.reason,
          delegate: p.delegate ? (p.delegate.name ?? p.delegate.handle) : null,
        })),
      );
    }
    case "get_booking_type": {
      const id = input?.id as string | undefined;
      const slug = input?.slug as string | undefined;
      if (!id && !slug) return JSON.stringify({ error: "Pass an id or slug." });
      const et = await db.query.eventTypes.findFirst({
        where: and(
          eq(schema.eventTypes.ownerId, userId),
          id ? eq(schema.eventTypes.id, id) : eq(schema.eventTypes.slug, slug as string),
        ),
      });
      if (!et) return JSON.stringify({ error: "No booking type with that id or slug." });
      return JSON.stringify({
        id: et.id,
        title: et.title,
        slug: et.slug,
        description: et.description,
        durationMinutes: et.durationMinutes,
        location: et.location,
        color: et.color,
        isActive: et.isActive,
        bufferBeforeMinutes: et.bufferBeforeMinutes,
        bufferAfterMinutes: et.bufferAfterMinutes,
        minimumNoticeMinutes: et.minimumNoticeMinutes,
        bookingWindowDays: et.bookingWindowDays,
        dailyBookingLimit: et.dailyBookingLimit,
        weeklyBookingLimit: et.weeklyBookingLimit,
        maxAttendees: et.maxAttendees,
        requiresConfirmation: et.requiresConfirmation,
        isPrivate: et.isPrivate,
        price: et.price,
        currency: et.currency,
      });
    }
    case "search_knowledge": {
      const query = (input?.query as string) ?? "";
      const matches = searchKnowledge(query, 2);
      if (matches.length === 0) {
        return JSON.stringify({
          found: 0,
          note: "No matching article. Answer from the tools you have, or ask the host to clarify.",
        });
      }
      return JSON.stringify({
        found: matches.length,
        articles: matches.map((m) => ({ title: m.title, content: m.body })),
        note: "Answer the host from these articles, in your own words and concisely.",
      });
    }
    case "list_booking_types": {
      const rows = await db.query.eventTypes.findMany({
        where: and(eq(schema.eventTypes.ownerId, userId), notPersonalType),
        columns: { id: true, title: true, slug: true, durationMinutes: true, isActive: true },
        orderBy: desc(schema.eventTypes.createdAt),
      });
      return JSON.stringify(rows);
    }
    case "get_availability": {
      const schedule = await db.query.schedules.findFirst({
        where: and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)),
        with: { availabilityRules: true, dateOverrides: true },
      });
      const days: { start: string; end: string }[][] = [[], [], [], [], [], [], []];
      for (const r of schedule?.availabilityRules ?? []) {
        days[r.dayOfWeek]!.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
      }
      const overrides = (schedule?.dateOverrides ?? []).map((o) => ({
        date: o.date,
        start: o.startTime ? o.startTime.slice(0, 5) : null,
        end: o.endTime ? o.endTime.slice(0, 5) : null,
      }));
      return JSON.stringify({ timezone: schedule?.timezone ?? "UTC", days, overrides });
    }
    case "get_preferences": {
      const p = await db.query.userPreferences.findFirst({
        where: eq(schema.userPreferences.userId, userId),
      });
      return JSON.stringify({
        timeFormat: p?.timeFormat ?? "12h",
        weekStartsOn: p?.weekStartsOn ?? 0,
        theme: p?.theme ?? "system",
        defaultReminderOffsets: p?.defaultReminderOffsets ?? [...DEFAULT_REMINDER_OFFSETS],
        adaptiveAvailability: p?.adaptiveAvailability ?? false,
        maxMeetingsPerDay: p?.maxMeetingsPerDay ?? 5,
        travelBufferMinutes: p?.travelBufferMinutes ?? 0,
        reclaimCancelledTime: p?.reclaimCancelledTime ?? false,
        overflowNotifyEnabled: p?.overflowNotifyEnabled ?? false,
        briefingEnabled: p?.briefingEnabled ?? false,
        briefingHour: p?.briefingHour ?? 8,
        lunchEnabled: p?.lunchEnabled ?? false,
        lunchStartMinute: p?.lunchStartMinute ?? 720,
        lunchEndMinute: p?.lunchEndMinute ?? 780,
      });
    }
    case "list_focus_blocks": {
      const rows = await db.query.timeBlocks.findMany({
        where: and(eq(schema.timeBlocks.userId, userId), gte(schema.timeBlocks.endsAt, new Date())),
        orderBy: asc(schema.timeBlocks.startsAt),
        limit: 50,
      });
      return JSON.stringify(
        rows.map((b) => ({
          id: b.id,
          title: b.title,
          kind: b.kind,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          seriesId: b.seriesId,
        })),
      );
    }
    case "find_focus_time": {
      const args = (input ?? {}) as Record<string, unknown>;
      const blocks = await findFocusBlocks(userId, {
        hoursNeeded: args.hoursNeeded as number | undefined,
        chunkMinutes: args.chunkMinutes as number | undefined,
        days: args.days as number | undefined,
        byDate: args.byDate ? new Date(args.byDate as string) : null,
      });
      const totalMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);
      return JSON.stringify({
        found: blocks.length,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        blocks,
        note: blocks.length
          ? "Show these times to the host, then call protect_focus_time with the same blocks to hold them."
          : "No open blocks in that window - suggest a longer window, a shorter block, or fewer hours.",
      });
    }
    case "list_notification_channels": {
      const rows = await db.query.notificationChannels.findMany({
        where: eq(schema.notificationChannels.userId, userId),
      });
      return JSON.stringify(
        rows.map((c) => {
          let label: string = c.type;
          try {
            label = maskChannel(
              c.type as DeliverableChannel,
              decryptJson<ChannelConfig>(c.encryptedConfig),
            );
          } catch {
            // leave raw type if the blob won't decrypt
          }
          return { id: c.id, type: c.type, label, remindersEnabled: c.remindersEnabled };
        }),
      );
    }
    case "get_profile": {
      const u = await db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        columns: { name: true, handle: true, timezone: true },
      });
      return JSON.stringify({
        name: u?.name ?? null,
        handle: u?.handle ?? null,
        timezone: u?.timezone ?? "UTC",
      });
    }
    case "list_calendars": {
      const rows = await db.query.calendarConnections.findMany({
        where: eq(schema.calendarConnections.userId, userId),
        orderBy: asc(schema.calendarConnections.createdAt),
        with: { calendars: { columns: { id: true } } },
      });
      return JSON.stringify(
        rows.map((c) => ({
          id: c.id,
          provider: c.provider,
          account: c.externalAccountId,
          status: c.status,
          calendarCount: c.calendars.length,
        })),
      );
    }
    case "list_teams": {
      const rows = await db.query.teamMembers.findMany({
        where: eq(schema.teamMembers.userId, userId),
        with: { team: { with: { members: { columns: { id: true } } } } },
      });
      return JSON.stringify(
        rows.map((m) => ({
          id: m.team.id,
          name: m.team.name,
          slug: m.team.slug,
          memberCount: m.team.members.length,
          role: m.role,
        })),
      );
    }
    case "list_automations": {
      const rows = await db.query.automationRules.findMany({
        where: eq(schema.automationRules.userId, userId),
        orderBy: asc(schema.automationRules.createdAt),
      });
      return JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          trigger: r.trigger,
          action: r.action,
          offsetMinutes: r.offsetMinutes,
          matchTitle: r.matchTitle,
        })),
      );
    }
    case "list_workflows": {
      const { organizationId } = await ensureUserWorkspace(userId);
      const rows = await db.query.workflows.findMany({
        where: eq(schema.workflows.organizationId, organizationId),
        orderBy: asc(schema.workflows.createdAt),
      });
      return JSON.stringify(
        rows.map((w) => ({
          id: w.id,
          name: w.name,
          trigger: w.trigger,
          offsetMinutes: w.offsetMinutes,
          isActive: w.isActive,
        })),
      );
    }
    case "get_analytics": {
      const d = input?.days;
      const days = typeof d === "number" ? d : 30;
      const to = new Date();
      const from = new Date(to.getTime() - days * 86_400_000);
      const data = await computeAnalytics({ userId, from, to });
      return JSON.stringify({ windowDays: days, currency: data.currency, ...data.totals });
    }
    default:
      return `Unknown read tool: ${name}`;
  }
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Execute a confirmed action tool. Validates input again (defense in depth). */
export async function executeActionTool(
  userId: string,
  name: string,
  rawInput: unknown,
): Promise<ActionResult> {
  const tool = getTool(name);
  if (!tool || tool.kind === "read") return { ok: false, message: "Unknown action." };
  const parsed = tool.zod.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: "That request wasn't valid." };
  const input = parsed.data as Record<string, unknown>;
  const db = getDb();

  try {
    switch (name) {
      case "create_booking_type": {
        const et = eventTypeInputSchema.safeParse({
          title: input.title,
          slug: input.slug,
          durationMinutes: input.durationMinutes,
          description: input.description,
          location: input.location,
          color: input.color,
        });
        if (!et.success) return { ok: false, message: "Those booking-type details aren't valid." };
        const d = et.data;
        const { organizationId, scheduleId, handle } = await ensureUserWorkspace(userId);
        const effectiveScheduleId = (await resolveScheduleId(userId, d.scheduleId)) ?? scheduleId;
        const [created] = await db
          .insert(schema.eventTypes)
          .values({
            organizationId,
            ownerId: userId,
            scheduleId: effectiveScheduleId,
            title: d.title,
            slug: d.slug,
            durationMinutes: d.durationMinutes,
            description: d.description,
            location: d.location,
            locationDetail: d.locationDetail,
            bufferBeforeMinutes: d.bufferBeforeMinutes,
            bufferAfterMinutes: d.bufferAfterMinutes,
            minimumNoticeMinutes: d.minimumNoticeMinutes,
            slotIntervalMinutes: d.slotIntervalMinutes,
            minimumGapMinutes: d.minimumGapMinutes,
            durationOptions: d.durationOptions,
            bookingWindowDays: d.bookingWindowDays,
            dailyBookingLimit: d.dailyBookingLimit,
            weeklyBookingLimit: d.weeklyBookingLimit,
            maxAttendees: d.maxAttendees,
            accessCodeHash: d.accessCode ? sha256hex(d.accessCode) : null,
            isPrivate: d.isPrivate,
            redirectUrl: d.redirectUrl,
            color: d.color,
            price: d.price,
            currency: d.currency,
            depositAmount: d.depositAmount,
            questions: d.questions,
          })
          .returning();
        return { ok: true, message: `Created “${d.title}” at /${handle}/${created!.slug}.` };
      }

      case "create_focus_block": {
        const start = new Date(input.startISO as string);
        if (Number.isNaN(start.getTime()))
          return { ok: false, message: "That start time is invalid." };
        const end = new Date(start.getTime() + (input.durationMinutes as number) * 60_000);
        await db.insert(schema.timeBlocks).values({
          userId,
          title: input.title as string,
          kind: (input.kind as "focus" | "personal" | "travel" | "other") ?? "focus",
          startsAt: start,
          endsAt: end,
          seriesId: null,
        });
        return { ok: true, message: `Held ${input.durationMinutes} min for “${input.title}”.` };
      }

      case "create_recurring_block": {
        let timezone = input.timezone as string | undefined;
        if (!timezone) {
          const u = await db.query.users.findFirst({
            where: eq(schema.users.id, userId),
            columns: { timezone: true },
          });
          timezone = u?.timezone ?? "UTC";
        }
        const occ = recurringBlockOccurrences(
          {
            daysOfWeek: input.daysOfWeek as number[],
            start: input.start as string,
            durationMinutes: input.durationMinutes as number,
            weeks: (input.weeks as number) ?? 12,
            timezone,
          },
          new Date(),
        );
        if (occ.length === 0) {
          return {
            ok: false,
            message: "That didn't produce any upcoming times to hold - check the days and time.",
          };
        }
        // One shared seriesId so the whole series shows as a group and can be
        // removed together via delete_focus_block(series: true).
        const seriesId = randomUUID();
        await db.insert(schema.timeBlocks).values(
          occ.map((o) => ({
            userId,
            title: input.title as string,
            kind: (input.kind as "focus" | "personal" | "travel" | "other") ?? "focus",
            startsAt: o.startsAt,
            endsAt: o.endsAt,
            seriesId,
          })),
        );
        return {
          ok: true,
          message: `Holding “${input.title}” ${occ.length} times over the next ${(input.weeks as number) ?? 12} weeks.`,
        };
      }

      case "protect_focus_time": {
        const title = input.title as string;
        const blocks = (input.blocks as { startISO: string; durationMinutes: number }[]) ?? [];
        const rows = blocks
          .map((b) => {
            const start = new Date(b.startISO);
            if (Number.isNaN(start.getTime())) return null;
            return {
              userId,
              title,
              kind: "focus" as const,
              startsAt: start,
              endsAt: new Date(start.getTime() + b.durationMinutes * 60_000),
              seriesId: null,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (rows.length === 0) return { ok: false, message: "No valid blocks to protect." };
        await db.insert(schema.timeBlocks).values(rows);
        const mins = rows.reduce(
          (s, r) => s + (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000,
          0,
        );
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        const dur = h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
        return {
          ok: true,
          message: `Protected ${rows.length} focus block${rows.length === 1 ? "" : "s"} (${dur}) for “${title}”.`,
        };
      }

      case "update_preferences": {
        const cur = await db.query.userPreferences.findFirst({
          where: eq(schema.userPreferences.userId, userId),
        });
        // `reminderOffsetsMinutes` is the model-facing alias for the DB column
        // `defaultReminderOffsets`; translate + strip it so it isn't inserted raw.
        const { reminderOffsetsMinutes, ...rest } = input as Record<string, unknown> & {
          reminderOffsetsMinutes?: number[];
        };
        const merged = {
          timeFormat: cur?.timeFormat ?? "12h",
          weekStartsOn: cur?.weekStartsOn ?? 0,
          theme: cur?.theme ?? "system",
          defaultReminderOffsets: cur?.defaultReminderOffsets ?? [...DEFAULT_REMINDER_OFFSETS],
          adaptiveAvailability: cur?.adaptiveAvailability ?? false,
          maxMeetingsPerDay: cur?.maxMeetingsPerDay ?? 5,
          travelBufferMinutes: cur?.travelBufferMinutes ?? 0,
          reclaimCancelledTime: cur?.reclaimCancelledTime ?? false,
          overflowNotifyEnabled: cur?.overflowNotifyEnabled ?? false,
          briefingEnabled: cur?.briefingEnabled ?? false,
          briefingHour: cur?.briefingHour ?? 8,
          lunchEnabled: cur?.lunchEnabled ?? false,
          lunchStartMinute: cur?.lunchStartMinute ?? 720,
          lunchEndMinute: cur?.lunchEndMinute ?? 780,
          ...rest,
          ...(reminderOffsetsMinutes ? { defaultReminderOffsets: reminderOffsetsMinutes } : {}),
        };
        merged.lunchEnabled =
          merged.lunchEnabled && merged.lunchEndMinute > merged.lunchStartMinute;
        merged.defaultReminderOffsets = [...new Set(merged.defaultReminderOffsets)].sort(
          (a, b) => b - a,
        );
        await db
          .insert(schema.userPreferences)
          .values({ userId, ...merged })
          .onConflictDoUpdate({ target: schema.userPreferences.userId, set: merged });
        const changed = Object.keys(rest);
        if (reminderOffsetsMinutes) changed.push("reminder timing");
        return { ok: true, message: `Updated ${changed.join(", ")}.` };
      }

      case "set_weekly_hours": {
        const { scheduleId } = await ensureUserWorkspace(userId);
        const days = input.days as {
          dayOfWeek: number;
          ranges: { start: string; end: string }[];
        }[];
        // Normalize "9:00" → "09:00" so pg `time` accepts it and the end>start
        // comparison is correct (lexical compare needs zero-padded hours).
        const hhmm = (s: string) => s.padStart(5, "0");
        const rows = days.flatMap((day) =>
          day.ranges
            .map((r) => ({ start: hhmm(r.start), end: hhmm(r.end) }))
            .filter((r) => r.end > r.start)
            .map((r) => ({
              scheduleId,
              dayOfWeek: day.dayOfWeek,
              startTime: `${r.start}:00`,
              endTime: `${r.end}:00`,
            })),
        );
        await db.transaction(async (tx) => {
          if (input.timezone) {
            await tx
              .update(schema.schedules)
              .set({ timezone: input.timezone as string })
              .where(eq(schema.schedules.id, scheduleId));
          }
          await tx
            .delete(schema.availabilityRules)
            .where(eq(schema.availabilityRules.scheduleId, scheduleId));
          if (rows.length) await tx.insert(schema.availabilityRules).values(rows);
        });
        return { ok: true, message: `Updated working hours for ${days.length} day(s).` };
      }

      case "set_out_of_office": {
        const startDate = input.startDate as string;
        const endDate = input.endDate as string;
        if (endDate < startDate) {
          return { ok: false, message: "The end date must be on or after the start date." };
        }
        // Cap per user (mirrors the settings route) so a runaway client can't fill
        // the table - every OOO row is scanned on each availability computation.
        const existing = await db.query.outOfOfficePeriods.findMany({
          where: eq(schema.outOfOfficePeriods.userId, userId),
          columns: { id: true },
          limit: 200,
        });
        if (existing.length >= 100) {
          return { ok: false, message: "You've hit the maximum of 100 out-of-office periods." };
        }
        // A delegate must be a real teammate - resolve the email against the host's
        // teammates and validate, never trust an arbitrary address.
        let delegateUserId: string | null = null;
        const delegateEmail = (input.delegateEmail as string | undefined)?.toLowerCase();
        if (delegateEmail) {
          const teammates = await listTeammates(userId);
          const delegateUser = await db.query.users.findFirst({
            where: eq(schema.users.email, delegateEmail),
            columns: { id: true, name: true },
          });
          if (!delegateUser || !teammates.some((t) => t.id === delegateUser.id)) {
            return {
              ok: false,
              message: `${delegateEmail} isn't one of your teammates - I can only redirect bookings to someone you share a team with.`,
            };
          }
          delegateUserId = delegateUser.id;
        }
        const reason = (input.reason as string | undefined)?.trim();
        await db.insert(schema.outOfOfficePeriods).values({
          userId,
          startDate,
          endDate,
          reason: reason?.length ? reason : null,
          delegateUserId,
        });
        const span =
          startDate === endDate
            ? `out of office on ${startDate}`
            : `out of office from ${startDate} to ${endDate}`;
        return {
          ok: true,
          message: `You're set ${span}${delegateEmail ? `, with bookings redirected to ${delegateEmail}` : ""}.`,
        };
      }

      case "set_date_override": {
        const { scheduleId } = await ensureUserWorkspace(userId);
        const date = input.date as string;
        const dayOff = input.unavailable === true || (!input.start && !input.end);
        let startTime: string | null = null;
        let endTime: string | null = null;
        if (!dayOff) {
          const hhmm = (s: string) => s.padStart(5, "0");
          const start = hhmm(input.start as string);
          const end = hhmm(input.end as string);
          if (end <= start) {
            return { ok: false, message: "The end time must be after the start time." };
          }
          startTime = `${start}:00`;
          endTime = `${end}:00`;
        }
        // Upsert: one override per (schedule, date).
        await db
          .insert(schema.dateOverrides)
          .values({ scheduleId, date, startTime, endTime })
          .onConflictDoUpdate({
            target: [schema.dateOverrides.scheduleId, schema.dateOverrides.date],
            set: { startTime, endTime },
          });
        return {
          ok: true,
          message: dayOff
            ? `${date} is now marked as a day off.`
            : `On ${date} your hours are now ${input.start as string}–${input.end as string}.`,
        };
      }

      case "reschedule_booking": {
        const uid = input.uid as string;
        // Ownership guard: only the host may move their own booking, even though
        // rescheduleBooking() looks up by uid globally.
        const owned = await db.query.bookings.findFirst({
          where: and(eq(schema.bookings.uid, uid), eq(schema.bookings.hostId, userId)),
          columns: { status: true, title: true },
        });
        if (!owned || owned.status === "cancelled") {
          return { ok: false, message: "I couldn't find that booking." };
        }
        try {
          await rescheduleBooking(uid, input.newStartISO as string);
          return { ok: true, message: `Moved “${owned.title}” to the new time.` };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "that time wasn't available";
          return { ok: false, message: `Couldn't move “${owned.title}” - ${msg}.` };
        }
      }

      case "update_booking": {
        const uid = input.uid as string;
        const booking = await db.query.bookings.findFirst({
          where: and(eq(schema.bookings.uid, uid), eq(schema.bookings.hostId, userId)),
          columns: {
            id: true,
            status: true,
            title: true,
            description: true,
            startsAt: true,
            endsAt: true,
            timezone: true,
            location: true,
          },
          with: { attendees: { columns: { email: true, name: true } } },
        });
        if (!booking || booking.status === "cancelled") {
          return { ok: false, message: "I couldn't find that booking." };
        }

        // Field changes on the booking row.
        const set: Record<string, unknown> = {};
        if (input.title !== undefined) set.title = input.title;
        if (input.notes !== undefined) set.description = input.notes;
        if (input.location !== undefined) {
          set.locationType = input.location;
          if (input.locationDetail !== undefined) set.location = input.locationDetail;
        } else if (input.locationDetail !== undefined) {
          set.location = input.locationDetail;
        }

        // Attendee add/remove, de-duplicated against the current list.
        const removeEmails = new Set(
          ((input.removeGuests as string[] | undefined) ?? []).map((e) => e.toLowerCase()),
        );
        const currentEmails = new Set(booking.attendees.map((a) => a.email.toLowerCase()));
        const toAdd = ((input.addGuests as { email: string; name?: string }[] | undefined) ?? [])
          .filter((g) => g.email.includes("@"))
          .filter((g) => !currentEmails.has(g.email.toLowerCase()));

        if (Object.keys(set).length === 0 && toAdd.length === 0 && removeEmails.size === 0) {
          return { ok: false, message: "Tell me what to change on that booking." };
        }

        if (Object.keys(set).length > 0) {
          await db.update(schema.bookings).set(set).where(eq(schema.bookings.id, booking.id));
        }
        if (removeEmails.size > 0) {
          await db
            .delete(schema.bookingAttendees)
            .where(eq(schema.bookingAttendees.bookingId, booking.id));
          // Re-insert the survivors + additions below in one pass.
        }
        const survivors = booking.attendees.filter((a) => !removeEmails.has(a.email.toLowerCase()));
        const finalAttendees = [
          ...survivors.map((a) => ({ email: a.email, name: a.name ?? undefined })),
          ...toAdd.map((g) => ({ email: g.email, name: g.name })),
        ];
        if (removeEmails.size > 0 || toAdd.length > 0) {
          if (removeEmails.size === 0) {
            // Only additions - insert just the new ones.
            if (toAdd.length > 0) {
              await db.insert(schema.bookingAttendees).values(
                toAdd.map((g) => ({
                  bookingId: booking.id,
                  email: g.email,
                  name: g.name ?? null,
                  timezone: booking.timezone,
                })),
              );
            }
          } else if (finalAttendees.length > 0) {
            // We cleared the table above; rewrite the full surviving + added set.
            await db.insert(schema.bookingAttendees).values(
              finalAttendees.map((a) => ({
                bookingId: booking.id,
                email: a.email,
                name: a.name ?? null,
                timezone: booking.timezone,
              })),
            );
          }
        }

        // Push the change to the connected calendar (best-effort). The provider
        // sends updated invites to attendees, so no separate email is needed.
        await updateBookingCalendarEvent(booking.id, {
          title: (set.title as string) ?? booking.title,
          description: (set.description as string) ?? booking.description ?? undefined,
          start: booking.startsAt,
          end: booking.endsAt,
          timezone: booking.timezone,
          attendees: finalAttendees,
          location: (set.location as string) ?? booking.location ?? undefined,
          createConference: false,
        }).catch(() => undefined);

        return { ok: true, message: `Updated “${(set.title as string) ?? booking.title}”.` };
      }

      case "shift_bookings": {
        const uids = input.uids as string[];
        const delta = input.deltaMinutes as number;
        const owned = await db.query.bookings.findMany({
          where: and(
            inArray(schema.bookings.uid, uids),
            eq(schema.bookings.hostId, userId),
            ne(schema.bookings.status, "cancelled"),
          ),
          columns: { uid: true, title: true, startsAt: true },
        });
        if (owned.length === 0) return { ok: false, message: "I couldn't find those bookings." };
        // Order so the shifted set doesn't collide with itself: moving later,
        // move the latest first; moving earlier, the earliest first.
        const ordered = [...owned].sort((a, b) =>
          delta > 0
            ? b.startsAt.getTime() - a.startsAt.getTime()
            : a.startsAt.getTime() - b.startsAt.getTime(),
        );
        let moved = 0;
        const failed: string[] = [];
        for (const b of ordered) {
          const newStart = new Date(b.startsAt.getTime() + delta * 60_000).toISOString();
          try {
            await rescheduleBooking(b.uid, newStart);
            moved++;
          } catch {
            failed.push(b.title);
          }
        }
        if (moved === 0) {
          return { ok: false, message: "Couldn't move any of them - the new times weren't free." };
        }
        return {
          ok: true,
          message: failed.length
            ? `Moved ${moved}; couldn't move ${failed.length} (${failed.join(", ")}) - those times weren't free.`
            : `Moved ${moved} booking${moved === 1 ? "" : "s"}.`,
        };
      }

      case "cancel_bookings": {
        const uids = input.uids as string[];
        const series = input.scope === "series";
        const reason = input.reason as string | undefined;
        const owned = await db.query.bookings.findMany({
          where: and(inArray(schema.bookings.uid, uids), eq(schema.bookings.hostId, userId)),
          columns: { uid: true },
        });
        const ownedUids = new Set(owned.map((b) => b.uid));
        if (ownedUids.size === 0) return { ok: false, message: "I couldn't find those bookings." };
        let count = 0;
        for (const uid of uids) {
          if (!ownedUids.has(uid)) continue;
          if (series) count += await cancelBookingSeries(uid, reason);
          else if (await cancelBooking(uid, reason)) count++;
        }
        if (count === 0) {
          return { ok: false, message: "Nothing to cancel - they may already be cancelled." };
        }
        return { ok: true, message: `Cancelled ${count} booking${count === 1 ? "" : "s"}.` };
      }

      case "delete_booking_type": {
        const id = input.id as string;
        const et = await db.query.eventTypes.findFirst({
          where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, userId)),
          columns: { id: true, title: true },
        });
        if (!et) return { ok: false, message: "I couldn't find that booking type." };
        const hasBooking = await db.query.bookings.findFirst({
          where: eq(schema.bookings.eventTypeId, id),
          columns: { id: true },
        });
        if (hasBooking) {
          await db
            .update(schema.eventTypes)
            .set({ isActive: false })
            .where(eq(schema.eventTypes.id, id));
          return {
            ok: true,
            message: `Archived “${et.title}” - it has bookings, so it was deactivated rather than deleted.`,
          };
        }
        await db.delete(schema.eventTypes).where(eq(schema.eventTypes.id, id));
        return { ok: true, message: `Deleted “${et.title}”.` };
      }

      case "delete_focus_block": {
        const id = input.id as string;
        const blk = await db.query.timeBlocks.findFirst({
          where: and(eq(schema.timeBlocks.id, id), eq(schema.timeBlocks.userId, userId)),
          columns: { id: true, seriesId: true, title: true },
        });
        if (!blk) return { ok: false, message: "I couldn't find that block." };
        if (input.series && blk.seriesId) {
          await db
            .delete(schema.timeBlocks)
            .where(
              and(
                eq(schema.timeBlocks.userId, userId),
                eq(schema.timeBlocks.seriesId, blk.seriesId),
              ),
            );
          return { ok: true, message: `Deleted the “${blk.title}” series.` };
        }
        await db.delete(schema.timeBlocks).where(eq(schema.timeBlocks.id, id));
        return { ok: true, message: `Deleted “${blk.title}”.` };
      }

      case "update_booking_type": {
        const id = input.id as string;
        const et = await db.query.eventTypes.findFirst({
          where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, userId)),
          columns: { id: true, title: true },
        });
        if (!et) return { ok: false, message: "I couldn't find that booking type." };
        const set: Record<string, unknown> = {};
        // Only fields the caller passed are changed (partial update).
        for (const k of [
          "title",
          "description",
          "durationMinutes",
          "color",
          "location",
          "bufferBeforeMinutes",
          "bufferAfterMinutes",
          "minimumNoticeMinutes",
          "bookingWindowDays",
          "dailyBookingLimit",
          "weeklyBookingLimit",
          "maxAttendees",
          "requiresConfirmation",
          "isPrivate",
        ] as const) {
          if (input[k] !== undefined) set[k] = input[k];
        }
        if (Object.keys(set).length === 0) {
          return { ok: false, message: "Tell me what to change on that booking type." };
        }
        await db.update(schema.eventTypes).set(set).where(eq(schema.eventTypes.id, id));
        return { ok: true, message: `Updated “${et.title}”.` };
      }

      case "set_booking_type_active": {
        const id = input.id as string;
        const et = await db.query.eventTypes.findFirst({
          where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, userId)),
          columns: { id: true, title: true },
        });
        if (!et) return { ok: false, message: "I couldn't find that booking type." };
        await db
          .update(schema.eventTypes)
          .set({ isActive: input.active as boolean })
          .where(eq(schema.eventTypes.id, id));
        return {
          ok: true,
          message: `“${et.title}” is now ${input.active ? "active" : "inactive"}.`,
        };
      }

      case "add_notification_channel": {
        const type = input.type as "slack" | "sms" | "whatsapp";
        const chInput =
          type === "slack" ? { type, webhookUrl: input.webhookUrl } : { type, phone: input.phone };
        const parsed = channelInputSchema.safeParse(chInput);
        if (!parsed.success) {
          return {
            ok: false,
            message:
              type === "slack"
                ? "That doesn't look like a valid Slack webhook URL (must start with https://hooks.slack.com/)."
                : "Use an international phone number like +14155551234.",
          };
        }
        if (!availableChannels().includes(type)) {
          return { ok: false, message: `${type} isn't enabled on this server.` };
        }
        const config = configFromInput(parsed.data);
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        const test = await dispatchToChannel(type, config, {
          title: "DayOtter connected",
          body: "This channel will now receive your meeting reminders.",
          url: `${appUrl}/settings/notifications`,
        });
        if (!test.ok) {
          return { ok: false, message: "Couldn't reach that channel - double-check the details." };
        }
        await db.insert(schema.notificationChannels).values({
          userId,
          type,
          encryptedConfig: encryptJson(config),
          isVerified: true,
          remindersEnabled: true,
        });
        return { ok: true, message: `Added a ${type} reminder channel.` };
      }

      case "create_team": {
        const name = input.name as string;
        const { organizationId } = await ensureUserWorkspace(userId);
        const slug = await uniqueSlug(slugify(name), async (v) =>
          Boolean(
            await db.query.teams.findFirst({
              where: and(eq(schema.teams.organizationId, organizationId), eq(schema.teams.slug, v)),
            }),
          ),
        );
        const [team] = await db
          .insert(schema.teams)
          .values({ organizationId, name, slug })
          .returning();
        if (!team) return { ok: false, message: "Couldn't create that team." };
        await db
          .insert(schema.teamMembers)
          .values({ teamId: team.id, userId, role: "owner", priority: 1 })
          .onConflictDoNothing();
        return { ok: true, message: `Created the team “${name}”.` };
      }

      case "update_timezone": {
        const tz = input.timezone as string;
        if (!DateTime.local().setZone(tz).isValid) {
          return { ok: false, message: `“${tz}” isn't a valid timezone.` };
        }
        // The availability engine computes bookable slots from the SCHEDULE's
        // timezone, not users.timezone - so update both, or slot generation
        // wouldn't move with the user (was a silent no-op for scheduling).
        await db.transaction(async (tx) => {
          await tx.update(schema.users).set({ timezone: tz }).where(eq(schema.users.id, userId));
          await tx
            .update(schema.schedules)
            .set({ timezone: tz })
            .where(and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)));
        });
        return { ok: true, message: `Your timezone is now ${tz}.` };
      }

      case "toggle_channel_reminders": {
        const id = input.id as string;
        const ch = await db.query.notificationChannels.findFirst({
          where: and(
            eq(schema.notificationChannels.id, id),
            eq(schema.notificationChannels.userId, userId),
          ),
          columns: { id: true },
        });
        if (!ch) return { ok: false, message: "I couldn't find that channel." };
        await db
          .update(schema.notificationChannels)
          .set({ remindersEnabled: input.enabled as boolean })
          .where(eq(schema.notificationChannels.id, id));
        return {
          ok: true,
          message: `Reminders ${input.enabled ? "on" : "off"} for that channel.`,
        };
      }

      case "remove_channel": {
        const id = input.id as string;
        const ch = await db.query.notificationChannels.findFirst({
          where: and(
            eq(schema.notificationChannels.id, id),
            eq(schema.notificationChannels.userId, userId),
          ),
          columns: { id: true },
        });
        if (!ch) return { ok: false, message: "I couldn't find that channel." };
        await db.delete(schema.notificationChannels).where(eq(schema.notificationChannels.id, id));
        return { ok: true, message: "Removed that notification channel." };
      }

      case "add_team_member": {
        const teamId = input.teamId as string;
        const email = (input.email as string).toLowerCase();
        const membership = await db.query.teamMembers.findFirst({
          where: and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)),
          columns: { role: true },
        });
        if (!membership) return { ok: false, message: "You're not a member of that team." };
        if (membership.role !== "owner" && membership.role !== "admin") {
          return { ok: false, message: "Only team owners/admins can add members." };
        }
        const invitee = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
          columns: { id: true, name: true, email: true },
        });
        if (!invitee) {
          return {
            ok: false,
            message: "No DayOtter account with that email yet - they need to sign up first.",
          };
        }
        await db
          .insert(schema.teamMembers)
          .values({ teamId, userId: invitee.id, priority: 1 })
          .onConflictDoNothing();
        return { ok: true, message: `Added ${invitee.name ?? invitee.email} to the team.` };
      }

      case "create_automation": {
        const weekly = input.trigger === "weekly";
        const [created] = await db
          .insert(schema.automationRules)
          .values({
            userId,
            name: input.name as string,
            trigger: (input.trigger as "booking_created" | "weekly") ?? "booking_created",
            matchTitle: weekly ? null : (input.matchTitle as string) || null,
            action: (input.action as "prep_block" | "buffer_after" | "followup") ?? "prep_block",
            offsetMinutes: (input.offsetMinutes as number) ?? 15,
            dayOfWeek: weekly ? ((input.dayOfWeek as number) ?? null) : null,
            windowStart: weekly ? ((input.windowStart as string) ?? null) : null,
            windowEnd: weekly ? ((input.windowEnd as string) ?? null) : null,
          })
          .returning();
        return { ok: true, message: `Created automation \u201c${created!.name}\u201d.` };
      }

      case "toggle_automation": {
        const res = await db
          .update(schema.automationRules)
          .set({ enabled: input.enabled as boolean })
          .where(
            and(
              eq(schema.automationRules.id, input.id as string),
              eq(schema.automationRules.userId, userId),
            ),
          )
          .returning({ id: schema.automationRules.id });
        if (res.length === 0) return { ok: false, message: "I couldn't find that automation." };
        return { ok: true, message: `Automation ${input.enabled ? "enabled" : "disabled"}.` };
      }

      case "create_workflow": {
        const { organizationId } = await ensureUserWorkspace(userId);
        const [created] = await db
          .insert(schema.workflows)
          .values({
            organizationId,
            name: input.name as string,
            trigger: (input.trigger as "before_event" | "after_event") ?? "before_event",
            offsetMinutes: (input.offsetMinutes as number) ?? 60,
            subjectTemplate: (input.subjectTemplate as string) ?? "",
            bodyTemplate: input.bodyTemplate as string,
            isActive: (input.isActive as boolean) ?? true,
          })
          .returning();
        return { ok: true, message: `Created workflow \u201c${created!.name}\u201d.` };
      }

      case "delete_automation": {
        const res = await db
          .delete(schema.automationRules)
          .where(
            and(
              eq(schema.automationRules.id, input.id as string),
              eq(schema.automationRules.userId, userId),
            ),
          )
          .returning({ id: schema.automationRules.id });
        if (res.length === 0) return { ok: false, message: "I couldn't find that automation." };
        return { ok: true, message: "Deleted that automation rule." };
      }

      case "update_workflow": {
        const { organizationId } = await ensureUserWorkspace(userId);
        const id = input.id as string;
        const wf = await db.query.workflows.findFirst({
          where: and(
            eq(schema.workflows.id, id),
            eq(schema.workflows.organizationId, organizationId),
          ),
          columns: { id: true, name: true },
        });
        if (!wf) return { ok: false, message: "I couldn't find that workflow." };
        const set: Record<string, unknown> = {};
        if (input.name !== undefined) set.name = input.name;
        if (input.subjectTemplate !== undefined) set.subjectTemplate = input.subjectTemplate;
        if (input.bodyTemplate !== undefined) set.bodyTemplate = input.bodyTemplate;
        if (input.offsetMinutes !== undefined) set.offsetMinutes = input.offsetMinutes;
        if (input.isActive !== undefined) set.isActive = input.isActive;
        if (Object.keys(set).length === 0) {
          return { ok: false, message: "Tell me what to change on that workflow." };
        }
        await db.update(schema.workflows).set(set).where(eq(schema.workflows.id, id));
        return { ok: true, message: `Updated \u201c${wf.name}\u201d.` };
      }

      case "delete_workflow": {
        const { organizationId } = await ensureUserWorkspace(userId);
        const res = await db
          .delete(schema.workflows)
          .where(
            and(
              eq(schema.workflows.id, input.id as string),
              eq(schema.workflows.organizationId, organizationId),
            ),
          )
          .returning({ id: schema.workflows.id });
        if (res.length === 0) return { ok: false, message: "I couldn't find that workflow." };
        return { ok: true, message: "Deleted that workflow." };
      }

      default:
        return { ok: false, message: "That action isn't supported yet." };
    }
  } catch (err) {
    logger.error("ai action failed", { event: "ai_action_failed", tool: name, userId, err });
    return { ok: false, message: "That didn't go through - please try again." };
  }
}
