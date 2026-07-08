import { PreferencesForm } from "@/components/preferences-form";
import { getSession } from "@/lib/auth/session";
import { eq, getDb, schema } from "@calsync/db";

export const dynamic = "force-dynamic";

export default async function PreferencesSettingsPage() {
  const session = await getSession();
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, session!.user.id),
  });

  return (
    <PreferencesForm
      initial={{
        timeFormat: prefs?.timeFormat ?? "12h",
        weekStartsOn: prefs?.weekStartsOn ?? 0,
        theme: prefs?.theme ?? "system",
        defaultReminderOffsets: prefs?.defaultReminderOffsets ?? [1440, 60],
      }}
    />
  );
}
