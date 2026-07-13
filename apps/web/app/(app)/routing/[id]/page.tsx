import { PageHeader } from "@/components/page-header";
import { RoutingBuilder } from "@/components/routing-builder";
import { getSession } from "@/lib/auth/session";
import { getFormForHost, hostEventTypes } from "@/lib/routing/routing";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RoutingBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const [form, eventTypes] = await Promise.all([
    getFormForHost(id, session!.user.id),
    hostEventTypes(session!.user.id),
  ]);
  if (!form) notFound();

  const appHost = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <>
      <PageHeader eyebrow="Routing form" title={form.title} />
      <Link
        href="/routing"
        className="mb-4 inline-block text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        ← All routing forms
      </Link>
      <RoutingBuilder
        form={{
          id: form.id,
          title: form.title,
          description: form.description,
          isActive: form.isActive,
          fields: form.fields,
          routes: form.routes,
          fallbackEventTypeId: form.fallbackEventTypeId,
        }}
        eventTypes={eventTypes}
        shareUrl={`${appHost}/forms/${form.token}`}
        sharePath={`/forms/${form.token}`}
        responseCount={form.responses.length}
      />
    </>
  );
}
