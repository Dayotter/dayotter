import { cn } from "@/lib/cn";

/**
 * The DayOtter brand mark — an otter glyph on the accent square.
 *
 * ▶ To drop in the final logo: replace ONLY the inner <svg>…</svg> below with
 *   the supplied artwork (keep `fill="currentColor"` so it inherits white, or
 *   set explicit fills). Everything that references the mark across the app
 *   (nav, mobile nav, marketing nav, auth panel) renders through this one
 *   component, so a single edit here updates the whole product.
 */
export function BrandMark({
  size = 28,
  rounded = "rounded-sm",
  className,
}: {
  size?: number;
  rounded?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-[var(--color-accent)] text-white",
        rounded,
        className,
      )}
      style={{ height: size, width: size }}
    >
      {/* Interim otter mark — a solid silhouette so it reads on any background
          (accent square or frosted panel). Swap this whole <svg> for the final
          artwork; keep `fill="currentColor"` to inherit the mark colour. */}
      <svg
        width={Math.round(size * 0.74)}
        height={Math.round(size * 0.74)}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        {/* ears */}
        <circle cx="7.4" cy="6.6" r="2.6" />
        <circle cx="16.6" cy="6.6" r="2.6" />
        {/* head + snout (single silhouette) */}
        <path d="M12 4.3c4 0 6.6 2.7 6.6 6.7 0 2.6-1 4.9-2.7 6.3-.9.7-1.3 1-1.6 1.7-.3.7-.9 1.1-2.3 1.1s-2-.4-2.3-1.1c-.3-.7-.7-1-1.6-1.7C6.4 15.9 5.4 13.6 5.4 11 5.4 7 8 4.3 12 4.3Z" />
      </svg>
    </span>
  );
}
