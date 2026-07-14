import { GLOSSARY, getGlossaryTerm } from "@/lib/glossary";
import { OG_CONTENT_TYPE, OG_SIZE, ogClamp, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "DayOtter scheduling glossary";

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const t = getGlossaryTerm((await params).slug);
  return ogImage({
    eyebrow: t ? `Glossary · ${t.category}` : "Glossary",
    title: t?.term ?? "Scheduling glossary",
    subtitle: ogClamp(t?.short ?? "Plain-English definitions of scheduling terms."),
  });
}
