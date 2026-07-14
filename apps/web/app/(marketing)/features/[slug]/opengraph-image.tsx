import { FEATURES } from "@/lib/features";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter feature";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = FEATURES.find((x) => x.slug === slug);
  return ogImage({
    eyebrow: "Feature",
    title: f?.title ?? "DayOtter features",
    subtitle: ogClamp(f?.subtitle ?? "Everything you need to run your calendar."),
  });
}
