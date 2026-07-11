import { ChangePasswordForm } from "@/components/change-password-form";
import { ProfileForm } from "@/components/profile-form";
import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  const userId = session!.user.id;

  // Make sure the user has a handle (assigned lazily on first workspace action).
  await ensureUserWorkspace(userId);
  const db = getDb();
  const [user, prefs] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { name: true, timezone: true, handle: true },
    }),
    db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId),
      columns: { brandColor: true, welcomeMessage: true },
    }),
  ]);

  return (
    <>
      <ProfileForm
        initial={{
          name: user?.name ?? "",
          timezone: user?.timezone ?? "UTC",
          handle: user?.handle ?? "",
          brandColor: prefs?.brandColor ?? null,
          welcomeMessage: prefs?.welcomeMessage ?? "",
        }}
      />
      <ChangePasswordForm />
    </>
  );
}
