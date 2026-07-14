import { Analytics } from "@/components/analytics";
import { OrganizationJsonLd } from "@/components/seo/json-ld";
import { BRAND } from "@/lib/marketing";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Geist (Vercel) — a clean, modern grotesque sans used across professional
// software products. One family carries body + headings; Geist Mono handles the
// small uppercase eyebrow labels. Self-hosted via the `geist` package (no runtime
// network request).

const DESCRIPTION =
  "DayOtter is the AI-native, open-source scheduling platform. Otter books meetings, protects your focus, and clears the back-and-forth — confirm-first. Sync every calendar, run your team, self-host it all under AGPLv3.";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: "DayOtter — the AI-native, open-source scheduling platform",
    template: "%s — DayOtter",
  },
  description: DESCRIPTION,
  applicationName: BRAND.name,
  keywords: [
    "AI scheduling",
    "open source scheduling",
    "Calendly alternative",
    "Cal.com alternative",
    "team scheduling",
    "round robin scheduling",
    "booking page",
    "self-hosted scheduling",
    "AI calendar assistant",
    "focus time",
  ],
  authors: [{ name: BRAND.name, url: BRAND.url }],
  creator: BRAND.name,
  publisher: BRAND.name,
  alternates: { canonical: "/" },
  icons: { icon: "/brand/dayotter-icon.svg", apple: "/brand/dayotter-icon.svg" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "DayOtter — the AI-native, open-source scheduling platform",
    description: DESCRIPTION,
    url: BRAND.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DayOtter — the AI-native, open-source scheduling platform",
    description: DESCRIPTION,
    creator: "@dayotter",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

// Set the theme class before first paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <OrganizationJsonLd />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
