import { eq, getDb, schema } from "@dayotter/db";
import type { CSSProperties } from "react";

export interface HostBranding {
  brandColor: string | null;
  welcomeMessage: string | null;
}

/** Load a host's public booking-page branding (safe defaults when unset). */
export async function getHostBranding(userId: string): Promise<HostBranding> {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, userId),
    columns: { brandColor: true, welcomeMessage: true },
  });
  return {
    brandColor: prefs?.brandColor ?? null,
    welcomeMessage: prefs?.welcomeMessage ?? null,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Inline CSS-variable overrides that re-theme a public page to the host's brand
 * colour. Applied on the page wrapper so every `var(--color-accent)` descendant
 * (buttons, avatar, highlights) follows. Returns `{}` for an unset/invalid colour.
 */
export function brandStyle(brandColor: string | null | undefined): CSSProperties {
  if (!brandColor || !HEX.test(brandColor)) return {};
  return {
    "--color-accent": brandColor,
    "--color-accent-hover": brandColor,
  } as CSSProperties;
}
