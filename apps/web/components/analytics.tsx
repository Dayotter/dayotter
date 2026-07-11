"use client";

import { GA_ID, MIXPANEL_TOKEN, pageview } from "@/lib/analytics";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect } from "react";

function RouteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const qs = search?.toString();
    pageview(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, search]);

  return null;
}

/**
 * Loads the configured analytics providers and reports SPA route changes. Renders
 * nothing (and loads nothing) when no analytics env vars are set.
 */
export function Analytics() {
  // Mixpanel: load the browser SDK lazily, only when a token is present.
  useEffect(() => {
    const token = MIXPANEL_TOKEN;
    if (!token || window.mixpanel) return;
    let cancelled = false;
    import("mixpanel-browser").then((mod) => {
      if (cancelled) return;
      const mp = mod.default;
      mp.init(token, { track_pageview: false, persistence: "localStorage" });
      window.mixpanel = mp;
      pageview(window.location.pathname + window.location.search);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {GA_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
          </Script>
        </>
      ) : null}
      <Suspense fallback={null}>
        <RouteTracker />
      </Suspense>
    </>
  );
}
