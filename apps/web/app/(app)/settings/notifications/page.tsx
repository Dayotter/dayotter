import { NotificationChannelsForm } from "@/components/notification-channels-form";
import { OtterTextPanel } from "@/components/otter-text-panel";
import { getSession } from "@/lib/auth/session";
import { maskChannel } from "@/lib/notifications/channel-input";
import { decryptJson } from "@dayotter/core";
import { asc, eq, getDb, schema } from "@dayotter/db";
import type { ChannelConfig, DeliverableChannel } from "@dayotter/notifications";
import { availableChannels } from "@dayotter/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const session = await getSession();
  const [rows, user] = await Promise.all([
    getDb().query.notificationChannels.findMany({
      where: eq(schema.notificationChannels.userId, session!.user.id),
      orderBy: asc(schema.notificationChannels.createdAt),
    }),
    getDb().query.users.findFirst({
      where: eq(schema.users.id, session!.user.id),
      columns: { phoneNumber: true, phoneNumberVerified: true },
    }),
  ]);

  // The public Otter texting number (the Twilio SMS/WhatsApp number users text).
  const otterNumber =
    process.env.OTTER_SMS_NUMBER ??
    process.env.TWILIO_SMS_FROM ??
    process.env.TWILIO_WHATSAPP_FROM ??
    null;

  const channels = rows.map((c) => {
    let label: string = c.type;
    try {
      label = maskChannel(
        c.type as DeliverableChannel,
        decryptJson<ChannelConfig>(c.encryptedConfig),
      );
    } catch {
      // leave the raw type as the label if the blob won't decrypt
    }
    return {
      id: c.id,
      type: c.type,
      label,
      isVerified: c.isVerified,
      remindersEnabled: c.remindersEnabled,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <OtterTextPanel
        phoneNumber={user?.phoneNumber ?? null}
        verified={user?.phoneNumberVerified ?? false}
        otterNumber={otterNumber?.replace(/^whatsapp:/, "") ?? null}
      />
      <NotificationChannelsForm initialChannels={channels} available={availableChannels()} />
    </div>
  );
}
