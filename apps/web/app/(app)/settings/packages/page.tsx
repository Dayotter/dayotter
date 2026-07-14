import { PackagesManager } from "@/components/packages-manager";
import { getSession } from "@/lib/auth/session";
import { and, asc, eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function PackagesSettingsPage() {
  const session = await getSession();
  const eventTypes = await getDb().query.eventTypes.findMany({
    where: and(
      eq(schema.eventTypes.ownerId, session!.user.id),
      eq(schema.eventTypes.isActive, true),
    ),
    columns: { id: true, title: true },
    orderBy: asc(schema.eventTypes.title),
  });

  return <PackagesManager eventTypes={eventTypes.map((e) => ({ id: e.id, title: e.title }))} />;
}
