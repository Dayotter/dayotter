import { BRAND } from "@/lib/marketing";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep private/app + auth surfaces out of the index.
        disallow: ["/api/", "/dashboard", "/settings", "/sign-in", "/sign-up", "/onboarding"],
      },
    ],
    sitemap: `${BRAND.url}/sitemap.xml`,
    host: BRAND.url,
  };
}
