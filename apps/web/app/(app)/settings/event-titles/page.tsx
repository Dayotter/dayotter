import { EventTitlesForm } from "@/components/event-titles-form";
import { getSession } from "@/lib/auth/session";
import { notPersonalType } from "@/lib/booking/personal-event-type";
import { and, desc, eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function EventTitlesSettingsPage() {
  const session = await getSession();
  const userId = session!.user.id;
  const db = getDb();
  const [prefs, eventTypes] = await Promise.all([
    db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId),
      columns: { bookingTitleTemplate: true },
    }),
    db.query.eventTypes.findMany({
      where: and(eq(schema.eventTypes.ownerId, userId), notPersonalType),
      orderBy: desc(schema.eventTypes.createdAt),
      columns: { id: true, title: true, titleTemplate: true },
    }),
  ]);

  return (
    <EventTitlesForm
      initial={prefs?.bookingTitleTemplate ?? ""}
      host={session!.user.name || "You"}
      types={eventTypes.map((t) => ({ id: t.id, title: t.title, custom: !!t.titleTemplate }))}
    />
  );
}
