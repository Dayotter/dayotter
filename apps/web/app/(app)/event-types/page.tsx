import { CopyLinkButton } from "@/components/copy-link-button";
import { DuplicateEventTypeButton } from "@/components/duplicate-event-type-button";
import { OneOffLinkButton } from "@/components/one-off-link-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { eventColorVar } from "@/lib/booking/event-type-input";
import { desc, eq, getDb, schema } from "@dayotter/db";
import { Clock, ExternalLink, Pencil, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EventTypesPage() {
  const session = await getSession();
  const db = getDb();

  const eventTypes = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.ownerId, session!.user.id),
    orderBy: desc(schema.eventTypes.createdAt),
  });
  const handle = (session!.user as { handle?: string | null }).handle;

  return (
    <>
      <PageHeader
        eyebrow="Your links"
        title="Booking Types"
        description="The meetings people can book with you."
        action={
          <Link href="/event-types/new" className={buttonVariants({ variant: "primary" })}>
            <Plus size={16} /> New booking type
          </Link>
        }
      />

      {eventTypes.length === 0 ? (
        <EmptyState
          title="No booking types yet"
          description="Create your first bookable meeting — like a 30-minute intro call — and share the link."
          action={
            <Link href="/event-types/new" className={buttonVariants({ variant: "primary" })}>
              <Plus size={16} /> New booking type
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {eventTypes.map((et) => (
            <Card key={et.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-2 font-medium">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: eventColorVar(et.color) }}
                  />
                  {et.title}
                  {!et.isActive ? (
                    <span className="ml-2 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--color-muted)]">
                      hidden
                    </span>
                  ) : null}
                  {et.isPrivate ? (
                    <span className="ml-2 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] font-normal text-[var(--color-muted)]">
                      private
                    </span>
                  ) : null}
                </h3>
                <span className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                  <Clock size={13} /> {et.durationMinutes}m
                </span>
              </div>
              {et.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">
                  {et.description}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                {handle ? (
                  <div className="flex items-center gap-3">
                    <CopyLinkButton path={`/${handle}/${et.slug}`} />
                    <Link
                      href={`/${handle}/${et.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    >
                      Preview <ExternalLink size={13} />
                    </Link>
                  </div>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-3">
                  <OneOffLinkButton id={et.id} />
                  <DuplicateEventTypeButton id={et.id} />
                  <Link
                    href={`/event-types/${et.id}/edit`}
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    <Pencil size={13} /> Edit
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
