import { eventTypeInputSchema } from "@/lib/booking/event-type-input";
import { resolveScheduleId } from "@/lib/booking/schedule";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { maskChannel } from "@/lib/notifications/channel-input";
import { slugify, uniqueSlug } from "@/lib/slug";
import { DEFAULT_REMINDER_OFFSETS, decryptJson, logger, sha256hex } from "@dayotter/core";
import { and, asc, desc, eq, getDb, gte, schema } from "@dayotter/db";
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
export async function executeReadTool(userId: string, name: string): Promise<string> {
  const db = getDb();
  switch (name) {
    case "list_booking_types": {
      const rows = await db.query.eventTypes.findMany({
        where: eq(schema.eventTypes.ownerId, userId),
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

      case "update_preferences": {
        const cur = await db.query.userPreferences.findFirst({
          where: eq(schema.userPreferences.userId, userId),
        });
        const merged = {
          timeFormat: cur?.timeFormat ?? "12h",
          weekStartsOn: cur?.weekStartsOn ?? 0,
          theme: cur?.theme ?? "system",
          defaultReminderOffsets: cur?.defaultReminderOffsets ?? [...DEFAULT_REMINDER_OFFSETS],
          adaptiveAvailability: cur?.adaptiveAvailability ?? false,
          maxMeetingsPerDay: cur?.maxMeetingsPerDay ?? 5,
          travelBufferMinutes: cur?.travelBufferMinutes ?? 0,
          reclaimCancelledTime: cur?.reclaimCancelledTime ?? false,
          lunchEnabled: cur?.lunchEnabled ?? false,
          lunchStartMinute: cur?.lunchStartMinute ?? 720,
          lunchEndMinute: cur?.lunchEndMinute ?? 780,
          ...input,
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
        return { ok: true, message: `Updated ${Object.keys(input).join(", ")}.` };
      }

      case "set_weekly_hours": {
        const { scheduleId } = await ensureUserWorkspace(userId);
        const days = input.days as {
          dayOfWeek: number;
          ranges: { start: string; end: string }[];
        }[];
        const rows = days.flatMap((day) =>
          day.ranges
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
            message: `Archived “${et.title}” — it has bookings, so it was deactivated rather than deleted.`,
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
        if (input.title !== undefined) set.title = input.title;
        if (input.description !== undefined) set.description = input.description;
        if (input.durationMinutes !== undefined) set.durationMinutes = input.durationMinutes;
        if (input.color !== undefined) set.color = input.color;
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
        await db.update(schema.users).set({ timezone: tz }).where(eq(schema.users.id, userId));
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

      default:
        return { ok: false, message: "That action isn't supported yet." };
    }
  } catch (err) {
    logger.error("ai action failed", { event: "ai_action_failed", tool: name, userId, err });
    return { ok: false, message: "That didn't go through — please try again." };
  }
}
