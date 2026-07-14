import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter comparison";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = getComparison((await params).slug);
  return ogImage({
    eyebrow: "Compare",
    title: c?.title ?? "DayOtter comparisons",
    subtitle: ogClamp(c?.subtitle ?? "Honest, side-by-side scheduling comparisons."),
  });
}
