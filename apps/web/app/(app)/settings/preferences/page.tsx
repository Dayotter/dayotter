import { AnalyticsPreferences } from "@/components/analytics-preferences";
import { PreferencesForm } from "@/components/preferences-form";
import { getSession } from "@/lib/auth/session";
import { isSupportedLocale } from "@/lib/i18n/server";
import { eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function PreferencesSettingsPage() {
  const session = await getSession();
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, session!.user.id),
  });

  return (
    <>
      <PreferencesForm
        initial={{
          timeFormat: prefs?.timeFormat ?? "12h",
          weekStartsOn: prefs?.weekStartsOn ?? 0,
          theme: prefs?.theme ?? "system",
          locale: isSupportedLocale(prefs?.locale) ? prefs.locale : "en",
          defaultReminderOffsets: prefs?.defaultReminderOffsets ?? [1440, 60],
          adaptiveAvailability: prefs?.adaptiveAvailability ?? false,
          maxMeetingsPerDay: prefs?.maxMeetingsPerDay ?? 5,
          travelBufferMinutes: prefs?.travelBufferMinutes ?? 0,
          reclaimCancelledTime: prefs?.reclaimCancelledTime ?? false,
          overflowNotifyEnabled: prefs?.overflowNotifyEnabled ?? false,
          briefingEnabled: prefs?.briefingEnabled ?? false,
          briefingHour: prefs?.briefingHour ?? 8,
          scribeEnabled: prefs?.scribeEnabled ?? false,
          lunchEnabled: prefs?.lunchEnabled ?? false,
          lunchStartMinute: prefs?.lunchStartMinute ?? 720,
          lunchEndMinute: prefs?.lunchEndMinute ?? 780,
          bookingPageAssistant: prefs?.bookingPageAssistant ?? true,
        }}
      />
      <AnalyticsPreferences />
    </>
  );
}
