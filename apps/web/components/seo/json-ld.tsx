import { BRAND } from "@/lib/marketing";

/**
 * Structured data (schema.org JSON-LD) helpers. Rendered as inline scripts so
 * search engines get rich context: org identity, the app as a product, FAQ
 * rich-results, breadcrumbs, and blog articles. Keep the emitted objects small
 * and truthful — Google penalizes markup that doesn't match visible content.
 */

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON.stringify output is safe structured data
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/** Site-wide: who we are + the software product. Rendered once in the root layout. */
export function OrganizationJsonLd() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: BRAND.name,
          url: BRAND.url,
          logo: `${BRAND.url}/brand/dayotter-icon.svg`,
          email: BRAND.email,
          sameAs: [BRAND.x, BRAND.github],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: BRAND.name,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description:
            "AI-native, open-source scheduling platform. Otter books meetings, protects focus, and clears the back-and-forth — confirm-first.",
          offers: [
            { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
            { "@type": "Offer", price: "9", priceCurrency: "USD", name: "Pro (per seat / month)" },
          ],
          url: BRAND.url,
        }}
      />
    </>
  );
}

/** FAQ rich results — pass the same Q&As shown on the page. */
export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((i) => ({
          "@type": "Question",
          name: i.q,
          acceptedAnswer: { "@type": "Answer", text: i.a },
        })),
      }}
    />
  );
}

/** Breadcrumb trail for a deep page. `items` are ordered root → current. */
export function BreadcrumbJsonLd({ items }: { items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: `${BRAND.url}${it.path}`,
        })),
      }}
    />
  );
}

/** A blog post / article. */
export function ArticleJsonLd(props: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: props.title,
        description: props.description,
        url: `${BRAND.url}${props.path}`,
        ...(props.datePublished ? { datePublished: props.datePublished } : {}),
        author: { "@type": "Organization", name: BRAND.name },
        publisher: {
          "@type": "Organization",
          name: BRAND.name,
          logo: { "@type": "ImageObject", url: `${BRAND.url}/brand/dayotter-icon.svg` },
        },
      }}
    />
  );
}
