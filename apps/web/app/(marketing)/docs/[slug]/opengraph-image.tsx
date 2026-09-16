import { GUIDES, getGuide } from "@/lib/docs";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter docs";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  return ogImage({
    eyebrow: "Docs",
    title: guide?.title ?? "DayOtter docs",
    subtitle: ogClamp(guide?.summary ?? "Guides for setting up and running DayOtter."),
  });
}
