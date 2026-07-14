import { INTEGRATIONS, getIntegration } from "@/lib/integrations-content";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter integration";

export function generateStaticParams() {
  return INTEGRATIONS.map((i) => ({ slug: i.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const it = getIntegration((await params).slug);
  return ogImage({
    eyebrow: it ? `${it.category} integration` : "Integration",
    title: it ? `DayOtter + ${it.name}` : "DayOtter integrations",
    subtitle: ogClamp(it?.subtitle ?? "One calm scheduling layer over the tools you use."),
  });
}
