import { RescheduleWidget } from "@/components/reschedule-widget";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { eq, getDb, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { host: true },
  });
  if (!booking) notFound();
  if (booking.status === "cancelled") redirect(`/booking/${uid}`);

  const current = DateTime.fromJSDate(booking.startsAt)
    .setZone(booking.timezone)
    .toFormat("cccc, LLLL d 'at' h:mm a");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold">Reschedule your booking</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {booking.title} with {booking.host?.name ?? "your host"}
          </p>
          <div className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm">
            Currently: <span className="font-medium">{current}</span>{" "}
            <span className="text-[var(--color-muted)]">({booking.timezone})</span>
          </div>

          <div className="mt-6">
            <RescheduleWidget uid={uid} eventTypeId={booking.eventTypeId} />
          </div>

          <div className="mt-6">
            <Link
              href={`/booking/${uid}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Keep current time
            </Link>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
