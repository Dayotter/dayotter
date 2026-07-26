import type { BookingPixelConfig } from "@/lib/booking/analytics-pixels";
import Script from "next/script";

/**
 * Injects a host's booking-page analytics pixels. Every value here has already
 * passed `sanitizePixelConfig` (strict per-provider ID patterns), so none can
 * contain quotes or markup - templating the IDs into these fixed scripts is safe
 * and can't be turned into stored XSS.
 *
 * `trackBooking` (set on the confirmation page) additionally fires a conversion
 * event once the pixels have initialised.
 */
export function BookingPixels({
  config,
  trackBooking = false,
}: {
  config: BookingPixelConfig;
  trackBooking?: boolean;
}) {
  return (
    <>
      {config.ga4 ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4}`}
            strategy="afterInteractive"
          />
          <Script id="dayotter-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${config.ga4}');${
              trackBooking ? `gtag('event','booking_confirmed');` : ""
            }`}
          </Script>
        </>
      ) : null}

      {config.gtm ? (
        <Script id="dayotter-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtm}');${
            trackBooking ? `window.dataLayer.push({event:'booking_confirmed'});` : ""
          }`}
        </Script>
      ) : null}

      {config.metaPixel ? (
        <Script id="dayotter-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.metaPixel}');fbq('track','PageView');${
            trackBooking ? `fbq('track','Schedule');` : ""
          }`}
        </Script>
      ) : null}

      {config.fathom ? (
        <Script
          src="https://cdn.usefathom.com/script.js"
          data-site={config.fathom}
          strategy="afterInteractive"
        />
      ) : null}

      {config.plausible ? (
        <>
          <Script
            src="https://plausible.io/js/script.js"
            data-domain={config.plausible}
            strategy="afterInteractive"
          />
          {trackBooking ? (
            <Script id="dayotter-plausible-goal" strategy="afterInteractive">
              {`window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};plausible('Booking confirmed');`}
            </Script>
          ) : null}
        </>
      ) : null}
    </>
  );
}
