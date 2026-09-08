import { EventTypeForm } from "@/components/event-type-form";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { and, eq, getDb, schema } from "@dayotter/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditTeamEventTypePage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id: teamId, eventId } = await params;
  const session = await getSession();

  const team = await getDb().query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: { members: true },
  });
  if (!team) notFound();

  const me = team.members.find((m) => m.userId === session!.user.id);
  if (!me || (me.role !== "owner" && me.role !== "admin")) notFound();

  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, eventId), eq(schema.eventTypes.teamId, teamId)),
  });
  if (!eventType) notFound();

  return (
    <>
      <PageHeader title="Edit team event" description="Update how this team meeting is booked." />
      <EventTypeForm
        mode="edit"
        paymentsEnabled={paymentsEnabled}
        redirectTo={`/teams/${teamId}`}
        initial={{
          id: eventType.id,
          title: eventType.title,
          slug: eventType.slug,
          durationMinutes: eventType.durationMinutes,
          description: eventType.description,
          location: eventType.location,
          locationDetail: eventType.locationDetail,
          locations: eventType.locations,
          bufferBeforeMinutes: eventType.bufferBeforeMinutes,
          bufferAfterMinutes: eventType.bufferAfterMinutes,
          minimumNoticeMinutes: eventType.minimumNoticeMinutes,
          slotIntervalMinutes: eventType.slotIntervalMinutes,
          offsetStartMinutes: eventType.offsetStartMinutes,
          minimumGapMinutes: eventType.minimumGapMinutes,
          durationOptions: eventType.durationOptions,
          bookingWindowDays: eventType.bookingWindowDays ?? undefined,
          dailyBookingLimit: eventType.dailyBookingLimit,
          weeklyBookingLimit: eventType.weeklyBookingLimit,
          monthlyBookingLimit: eventType.monthlyBookingLimit,
          yearlyBookingLimit: eventType.yearlyBookingLimit,
          maxAttendees: eventType.maxAttendees,
          recurringCount: eventType.recurringCount,
          recurringFrequency: eventType.recurringFrequency as "weekly" | "biweekly" | "monthly",
          hasAccessCode: eventType.accessCodeHash != null,
          isPrivate: eventType.isPrivate,
          requiresConfirmation: eventType.requiresConfirmation,
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
