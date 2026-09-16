import { DeveloperSettings } from "@/components/developer-settings";
import { ProGate } from "@/components/upgrade-prompt";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/server/env";
import { eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function DeveloperSettingsPage() {
  const session = await getSession();
  const user = session?.user?.id
    ? await getDb().query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { handle: true },
      })
    : null;

  const appUrl = env.APP_URL;
  return (
    <ProGate feature="developer">
      <DeveloperSettings appUrl={appUrl} handle={user?.handle ?? "your-handle"} />
    </ProGate>
  );
}
