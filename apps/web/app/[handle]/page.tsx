import { HostAvatar } from "@/components/host-avatar";
import { Card } from "@/components/ui/card";
import { brandStyle, getHostBranding } from "@/lib/booking/branding";
import { LOCATION_LABELS } from "@/lib/booking/event-type-input";
import { and, asc, eq, getDb, schema } from "@dayotter/db";
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Public profile: every meeting a host offers, one link to share. */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const db = getDb();

  const host = await db.query.users.findFirst({ where: eq(schema.users.handle, handle) });
  if (!host) notFound();

  const [eventTypes, branding] = await Promise.all([
    db.query.eventTypes.findMany({
      where: and(
        eq(schema.eventTypes.ownerId, host.id),
        eq(schema.eventTypes.isActive, true),
        eq(schema.eventTypes.isPrivate, false),
      ),
      orderBy: asc(schema.eventTypes.createdAt),
    }),
    getHostBranding(host.id),
  ]);

  return (
    <main
      style={brandStyle(branding.brandColor)}
      className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <HostAvatar name={host.name ?? host.handle ?? "?"} image={host.image} size={64} />
        <h1 className="font-display mt-4 text-2xl tracking-[-0.01em]">
          {host.name ?? host.handle}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {branding.welcomeMessage ?? "Pick a meeting to book."}
        </p>
      </div>

      {eventTypes.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-muted)]">
          No public meetings available right now.
        </p>
      ) : (
        <div className="space-y-3">
          {eventTypes.map((et) => (
            <Link key={et.id} href={`/${handle}/${et.slug}`} className="block">
              <Card className="group flex items-center gap-4 p-5 transition-colors hover:border-[var(--color-accent)]">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">{et.title}</h2>
                  {et.description ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-muted)]">
                      {et.description}
                    </p>
                  ) : null}
                  <p className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {et.durationMinutes} min
                    </span>
                    <span>{LOCATION_LABELS[et.location] ?? et.location}</span>
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-[var(--color-faint)] transition-colors group-hover:text-[var(--color-accent)]"
                />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-[var(--color-faint)]">
        Powered by <span className="text-[var(--color-muted)]">DayOtter</span>
      </p>
    </main>
  );
}
