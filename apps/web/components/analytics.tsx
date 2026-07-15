"use client";

import {
  GA_ID,
  MIXPANEL_TOKEN,
  POSTHOG_HOST,
  POSTHOG_KEY,
  analyticsAllowed,
  pageview,
} from "@/lib/analytics";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect, useState } from "react";

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
 * Loads the configured analytics providers and reports SPA route changes.
 * Loads NOTHING when no provider env vars are set, or when the user has opted
 * out in this browser (Settings -> Preferences).
 */
export function Analytics() {
  // `analyticsAllowed` reads localStorage, so resolve it after mount to avoid a
  // hydration mismatch and to respect a mid-session opt-out on the next load.
  const [allowed, setAllowed] = useState(false);
  useEffect(() => setAllowed(analyticsAllowed()), []);

  // Mixpanel: load the browser SDK lazily, only when a token is present + allowed.
  useEffect(() => {
    const token = MIXPANEL_TOKEN;
    if (!allowed || !token || window.mixpanel) return;
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
  }, [allowed]);

  if (!allowed) return null;

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

      {POSTHOG_KEY ? (
        <Script id="posthog-init" strategy="afterInteractive">
          {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset get_distinct_id".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${POSTHOG_KEY}',{api_host:'${POSTHOG_HOST}',capture_pageview:false});`}
        </Script>
      ) : null}

      <Suspense fallback={null}>
        <RouteTracker />
      </Suspense>
    </>
  );
}
