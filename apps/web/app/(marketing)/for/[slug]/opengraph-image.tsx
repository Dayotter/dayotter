import { PERSONAS, getPersona } from "@/lib/personas";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter for you";

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = getPersona((await params).slug);
  return ogImage({
    eyebrow: p ? `For ${p.label}` : "For you",
    title: p?.title ?? "Scheduling shaped around how you work",
    subtitle: ogClamp(p?.subtitle ?? "The calm home for your time."),
  });
}
