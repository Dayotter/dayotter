import { cn } from "@/lib/cn";

/**
 * The DayOtter brand mark — the otter-with-calendar app icon.
 *
 * Renders the shared asset at /brand/dayotter-icon.svg, cropped so the rounded
 * tile fills the box. This is the single source of the logo across the app
 * (sidebar, mobile nav, marketing nav + footer, auth panel); swap the asset
 * file to update every placement at once.
 */
export function BrandMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const scale = 1.47; // crop the icon's transparent padding so the tile fills
  const inner = Math.round(size * scale);
  const offset = Math.round((inner - size) / 2);
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 overflow-hidden", className)}
      style={{ height: size, width: size, borderRadius: Math.round(size * 0.23) }}
    >
      <img
        src="/brand/dayotter-icon.svg"
        alt=""
        width={inner}
        height={inner}
        style={{ position: "absolute", top: -offset, left: -offset, maxWidth: "none" }}
      />
    </span>
  );
}
