import { CancelButton } from "@/components/cancel-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { eq, getDb, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CancelBookingPage({
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

  const when = DateTime.fromJSDate(booking.startsAt)
    .setZone(booking.timezone)
    .toFormat("cccc, LLLL d 'at' h:mm a");

  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:py-16">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold">Cancel this booking?</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            This will notify everyone and free up the time.
          </p>

          <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm">
            <p className="font-medium">{booking.title}</p>
            <p className="mt-0.5 text-[var(--color-muted)]">
              with {booking.host?.name ?? "your host"} · {when}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <CancelButton uid={uid} />
            <Link
              href={`/booking/${uid}`}
              className={`${buttonVariants({ variant: "outline" })} w-full`}
            >
              Keep my booking
            </Link>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
