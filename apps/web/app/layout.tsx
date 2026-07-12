import { Analytics } from "@/components/analytics";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Geist (Vercel) — a clean, modern grotesque sans used across professional
// software products. One family carries body + headings; Geist Mono handles the
// small uppercase eyebrow labels. Self-hosted via the `geist` package (no runtime
// network request).

export const metadata: Metadata = {
  title: "DayOtter — scheduling that respects every calendar you own",
  description:
    "The open-source home for your time. Sync every calendar, share availability across your team, and let people book you — beautifully.",
  icons: { icon: "/brand/dayotter-icon.svg", apple: "/brand/dayotter-icon.svg" },
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
