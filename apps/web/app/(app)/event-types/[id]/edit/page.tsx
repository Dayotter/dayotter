import { EventTypeForm } from "@/components/event-type-form";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, eq, getDb, schema } from "@dayotter/db";
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
      <PageHeader title="Edit booking type" description="Update how this meeting is booked." />
      <EventTypeForm
        mode="edit"
        paymentsEnabled={paymentsEnabled}
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
          slotIntervalMinutes: eventType.slotIntervalMinutes,
          minimumGapMinutes: eventType.minimumGapMinutes,
          durationOptions: eventType.durationOptions,
          bookingWindowDays: eventType.bookingWindowDays ?? undefined,
          dailyBookingLimit: eventType.dailyBookingLimit,
          weeklyBookingLimit: eventType.weeklyBookingLimit,
          maxAttendees: eventType.maxAttendees,
          recurringCount: eventType.recurringCount,
          recurringFrequency: eventType.recurringFrequency as "weekly" | "biweekly" | "monthly",
          hasAccessCode: eventType.accessCodeHash != null,
          isPrivate: eventType.isPrivate,
          redirectUrl: eventType.redirectUrl,
          color: eventType.color,
          price: eventType.price,
          currency: eventType.currency,
          depositAmount: eventType.depositAmount,
          questions: eventType.questions,
          scheduleId: eventType.scheduleId,
        }}
      />
    </>
  );
}
