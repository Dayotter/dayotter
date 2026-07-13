import { RoutingRunner } from "@/components/routing-runner";
import { Card, CardBody } from "@/components/ui/card";
import { getFormByToken } from "@/lib/routing/routing";
import { Split } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const form = await getFormByToken((await params).token);
  return { title: form ? `${form.title} — DayOtter` : "DayOtter" };
}

export default async function PublicRoutingFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const form = await getFormByToken(token);
  if (!form || form.fields.length === 0) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-14">
      <Card>
        <CardBody className="p-6 sm:p-8">
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Split size={13} /> {form.host?.name ? `${form.host.name}` : "Get routed"}
          </p>
          <h1 className="font-display text-2xl leading-tight tracking-[-0.01em]">{form.title}</h1>
          {form.description ? (
            <p className="mt-2 text-sm text-[var(--color-muted)]">{form.description}</p>
          ) : null}
          <div className="mt-6">
            <RoutingRunner token={token} fields={form.fields} />
          </div>
        </CardBody>
      </Card>
      <p className="mt-6 text-center text-xs text-[var(--color-faint)]">
        Powered by{" "}
        <Link href="/" className="hover:text-[var(--color-text)]">
          DayOtter
        </Link>
      </p>
    </main>
  );
}
