import { computeAnalytics } from "@/lib/booking/analytics";
import { eventTypeInputSchema } from "@/lib/booking/event-type-input";
import { findFocusBlocks } from "@/lib/booking/focus-suggestions";
import { notPersonalType } from "@/lib/booking/personal-event-type";
import { resolveScheduleId } from "@/lib/booking/schedule";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import {
  channelInputSchema,
  configFromInput,
  maskChannel,
} from "@/lib/notifications/channel-input";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  DEFAULT_REMINDER_OFFSETS,
  decryptJson,
  encryptJson,
  logger,
  sha256hex,
} from "@dayotter/core";
import { and, asc, desc, eq, getDb, gte, schema } from "@dayotter/db";
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
