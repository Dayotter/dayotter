import { EventTypeForm } from "@/components/event-type-form";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@calsync/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, session!.user.id)),
  });
  if (!eventType) notFound();

  return (
    <>
      <PageHeader title="Edit event type" description="Update how this meeting is booked." />
      <EventTypeForm
        mode="edit"
        initial={{
          id: eventType.id,
          title: eventType.title,
          slug: eventType.slug,
          durationMinutes: eventType.durationMinutes,
          description: eventType.description,
          location: eventType.location,
          locationDetail: eventType.locationDetail,
          bufferBeforeMinutes: eventType.bufferBeforeMinutes,
          bufferAfterMinutes: eventType.bufferAfterMinutes,
          minimumNoticeMinutes: eventType.minimumNoticeMinutes,
          bookingWindowDays: eventType.bookingWindowDays ?? undefined,
          dailyBookingLimit: eventType.dailyBookingLimit,
          isPrivate: eventType.isPrivate,
          redirectUrl: eventType.redirectUrl,
          questions: eventType.questions,
        }}
      />
    </>
  );
}
