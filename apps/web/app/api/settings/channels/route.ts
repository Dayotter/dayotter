import { requireFeature } from "@/lib/billing/require-feature";
import {
  channelInputSchema,
  configFromInput,
  maskChannel,
} from "@/lib/notifications/channel-input";
import { jsonError, withUser } from "@/lib/server/http";
import { decryptJson, encryptJson, logger } from "@dayotter/core";
import { asc, eq, getDb, schema } from "@dayotter/db";
import type { ChannelConfig, DeliverableChannel } from "@dayotter/notifications";
import { availableChannels, dispatchToChannel } from "@dayotter/notifications";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** List the user's notification channels with safe, masked destinations. */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.notificationChannels.findMany({
    where: eq(schema.notificationChannels.userId, u.id),
    orderBy: asc(schema.notificationChannels.createdAt),
  });

  const channels = rows.map((c) => {
    let label: string = c.type;
    try {
      label = maskChannel(
        c.type as DeliverableChannel,
        decryptJson<ChannelConfig>(c.encryptedConfig),
      );
    } catch {
      // Corrupt/undecryptable config - still list it so the user can delete it.
    }
    return {
      id: c.id,
      type: c.type,
      label,
      isVerified: c.isVerified,
      remindersEnabled: c.remindersEnabled,
    };
  });

  return NextResponse.json({ channels, available: availableChannels() });
});

/** Add a channel, then send a test message to verify it works. */
export const POST = withUser(async (u, request) => {
  const parsed = channelInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Push, Slack and WhatsApp reminders are free. Only SMS is Pro (it carries a
  // real per-message carrier cost).
  if (input.type === "sms") {
    const gate = await requireFeature(u.id, "sms_reminders");
    if (gate) return gate;
  }

  if (!availableChannels().includes(input.type)) {
    return jsonError(`${input.type} isn't enabled on this server.`, 400);
  }

  const config = configFromInput(input);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // Verify by delivering a real test message before we trust the channel.
  const test = await dispatchToChannel(input.type, config, {
    title: "DayOtter connected",
    body: "This channel will now receive your meeting reminders.",
    url: `${appUrl}/settings/notifications`,
  });
  if (!test.ok) {
    logger.warn("channel verify failed", {
      event: "channel_verify_failed",
      userId: u.id,
      type: input.type,
      reason: test.reason,
    });
    return jsonError("Couldn't reach that channel. Double-check the details and try again.", 400);
  }

  const [created] = await getDb()
    .insert(schema.notificationChannels)
    .values({
      userId: u.id,
      type: input.type,
      encryptedConfig: encryptJson(config),
      isVerified: true,
      remindersEnabled: true,
    })
    .returning();

  return NextResponse.json({
    channel: {
      id: created!.id,
      type: created!.type,
      label: maskChannel(input.type, config),
      isVerified: true,
      remindersEnabled: true,
    },
  });
});
