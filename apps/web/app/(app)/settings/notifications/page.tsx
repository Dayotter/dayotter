import { NotificationChannelsForm } from "@/components/notification-channels-form";
import { getSession } from "@/lib/auth/session";
import { maskChannel } from "@/lib/notifications/channel-input";
import { decryptJson } from "@calsync/core";
import { asc, eq, getDb, schema } from "@calsync/db";
import type { ChannelConfig, DeliverableChannel } from "@calsync/notifications";
import { availableChannels } from "@calsync/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const session = await getSession();
  const rows = await getDb().query.notificationChannels.findMany({
    where: eq(schema.notificationChannels.userId, session!.user.id),
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

  return <NotificationChannelsForm initialChannels={channels} available={availableChannels()} />;
}
