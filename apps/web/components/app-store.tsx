"use client";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  APP_CATEGORIES,
  type AppCategory,
  type AppDefinition,
  CATEGORY_LABELS,
  appsByCategory,
  searchApps,
} from "@/lib/apps/registry";
import type { AppStatus } from "@/lib/apps/status";
import { cn } from "@/lib/cn";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function StatusPill({ app, status }: { app: AppDefinition; status?: AppStatus }) {
  if (app.builtIn) {
    return (
      <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
        Included
      </span>
    );
  }
  if (!status?.configured) {
    return <span className="shrink-0 text-xs text-[var(--color-faint)]">Not configured</span>;
  }
  if (status.connected) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--color-success)]">
        <CheckCircle2 size={15} /> Connected
      </span>
    );
  }
  return null;
}

function AppTile({ app, status }: { app: AppDefinition; status?: AppStatus }) {
  const showConnect = !app.builtIn && status?.configured && !status.connected;
  const manageLabel = app.builtIn || status?.connected ? "Manage" : null;

  return (
    <Card>
      <CardBody className="flex items-center gap-3 px-4 py-3">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: app.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{app.name}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">{app.blurb}</p>
        </div>
        <StatusPill app={app} status={status} />
        {showConnect ? (
          app.external ? (
            <a href={app.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Connect
            </a>
          ) : (
            <Link href={app.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Connect
            </Link>
          )
        ) : manageLabel ? (
          <Link
            href={app.href}
            className="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            {manageLabel}
          </Link>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function AppStore({
  apps,
  statuses,
}: {
  apps: AppDefinition[];
  statuses: Record<string, AppStatus>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AppCategory | "all">("all");

  const groups = useMemo(() => {
    const filtered = searchApps(query, apps).filter(
      (a) => category === "all" || a.category === category,
    );
    return appsByCategory(filtered);
  }, [query, category, apps]);

  const total = groups.reduce((n, g) => n + g.apps.length, 0);
  const availableCategories = APP_CATEGORIES.filter((c) => apps.some((a) => a.category === c));

  return (
    <>
      <Input
        placeholder="Search apps…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search apps"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["all", ...availableCategories] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              category === c
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-muted)]">
          No apps match “{query}”.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((g) => (
            <section key={g.category}>
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-muted)]">{g.label}</h3>
              <div className="space-y-2">
                {g.apps.map((app) => (
                  <AppTile key={app.id} app={app} status={statuses[app.id]} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
