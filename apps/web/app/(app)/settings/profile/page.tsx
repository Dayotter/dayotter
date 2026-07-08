import { ProfileForm } from "@/components/profile-form";
import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { eq, getDb, schema } from "@calsync/db";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await getSession();
  const userId = session!.user.id;

  // Make sure the user has a handle (assigned lazily on first workspace action).
  await ensureUserWorkspace(userId);
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { name: true, timezone: true, handle: true },
  });

  return (
    <ProfileForm
      initial={{
        name: user?.name ?? "",
        timezone: user?.timezone ?? "UTC",
        handle: user?.handle ?? "",
      }}
    />
  );
}
