import { ImageResponse } from "next/og";

/**
 * Shared Open Graph image template, rendered per page by the `opengraph-image.tsx`
 * files in each dynamic route segment. One branded 1200x630 card - eyebrow, title,
 * subtitle, wordmark - so every /vs, /for, /features, /integrations and /glossary
 * page gets a distinct social preview instead of the one static site image.
 *
 * Rendered with Satori (via next/og): flexbox only, no external fonts loaded (the
 * built-in default keeps it dependency-free and build-safe).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#faf9f6";
const SURFACE = "#ffffff";
const TEXT = "#191720";
const MUTED = "#6b6875";
const ACCENT = "#6743e6";
const BORDER = "#e7e4dc";

export function ogImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: BG,
        backgroundImage: `radial-gradient(900px 420px at 82% -8%, ${ACCENT}22, transparent 70%)`,
        fontFamily: "sans-serif",
      }}
    >
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: ACCENT,
            display: "flex",
          }}
        />
        <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>
          DayOtter
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow ? (
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 3,
              color: ACCENT,
              marginBottom: 24,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            color: TEXT,
            maxWidth: 960,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.35,
              color: MUTED,
              marginTop: 28,
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {/* Footer strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            padding: "12px 22px",
            borderRadius: 999,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            fontSize: 24,
            color: TEXT,
            fontWeight: 600,
          }}
        >
          dayotter.com
        </div>
        <div style={{ fontSize: 22, color: MUTED }}>
          AI-native, open-source scheduling
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}

/** Trim long subtitles so the card never overflows. */
export function ogClamp(text: string, max = 130): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
