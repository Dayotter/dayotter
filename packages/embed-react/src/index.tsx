import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Where the booking pages are served. Point at your own instance when self-hosting. */
export const DEFAULT_BASE_URL = "https://dayotter.com";

export interface BookingSuccess {
  /** The booking's public uid. */
  uid: string;
  /** Relative confirmation URL, e.g. `/booking/<uid>`. */
  url: string;
}

export interface EmbedOptions {
  /** Public booking handle, e.g. "ada". */
  handle: string;
  /** Event-type slug, e.g. "intro". */
  slug: string;
  /** Instance origin (no trailing slash needed). Defaults to dayotter.com. */
  baseUrl?: string;
  /** Force a colour scheme, or follow the frame's default ("auto"). */
  theme?: "light" | "dark" | "auto";
  /** Accent colour as a hex string (with or without leading #). */
  primaryColor?: string;
  /** Hide the event-details header (show only the time picker). */
  hideDetails?: boolean;
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Build the `/embed/<handle>/<slug>` URL with the white-label query params. */
export function buildEmbedUrl(opts: EmbedOptions): string {
  const base = trimSlash(opts.baseUrl || DEFAULT_BASE_URL);
  const params = new URLSearchParams();
  if (opts.theme && opts.theme !== "auto") params.set("theme", opts.theme);
  if (opts.primaryColor) params.set("primaryColor", opts.primaryColor.replace(/^#/, ""));
  if (opts.hideDetails) params.set("hideDetails", "1");
  const qs = params.toString();
  return `${base}/embed/${encodeURIComponent(opts.handle)}/${encodeURIComponent(opts.slug)}${
    qs ? `?${qs}` : ""
  }`;
}

interface DayOtterMessage {
  type?: string;
  height?: number;
  uid?: string;
  url?: string;
}

export interface DayOtterBookerProps extends EmbedOptions {
  /** Fired once a booking is confirmed inside the frame. */
  onBookingSuccessful?: (booking: BookingSuccess) => void;
  /** Fired whenever the embedded content reports a new height. */
  onHeightChange?: (height: number) => void;
  /** Initial height before the frame reports its own (px). Default 640. */
  initialHeight?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Inline embedded DayOtter booker. Renders the booking flow in an iframe that
 * auto-resizes to its content (via postMessage) and reports booking success.
 */
export function DayOtterBooker({
  onBookingSuccessful,
  onHeightChange,
  initialHeight = 640,
  className,
  style,
  handle,
  slug,
  baseUrl,
  theme,
  primaryColor,
  hideDetails,
}: DayOtterBookerProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const src = useMemo(
    () => buildEmbedUrl({ handle, slug, baseUrl, theme, primaryColor, hideDetails }),
    [handle, slug, baseUrl, theme, primaryColor, hideDetails],
  );
  const origin = useMemo(() => {
    try {
      return new URL(src).origin;
    } catch {
      return "";
    }
  }, [src]);

  useEffect(() => {
    function onMessage(e: MessageEvent<DayOtterMessage>) {
      // Only trust messages from the iframe we rendered.
      if (origin && e.origin !== origin) return;
      if (ref.current && e.source !== ref.current.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "dayotter:height" && typeof data.height === "number") {
        setHeight(data.height);
        onHeightChange?.(data.height);
      } else if (data.type === "dayotter:booking" && data.uid && data.url) {
        onBookingSuccessful?.({ uid: data.uid, url: data.url });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin, onBookingSuccessful, onHeightChange]);

  return (
    <iframe
      ref={ref}
      src={src}
      title="DayOtter booking"
      loading="lazy"
      allow="payment"
      className={className}
      style={{ width: "100%", border: "0", height, ...style }}
    />
  );
}

export interface PopupOptions extends EmbedOptions {
  onBookingSuccessful?: (booking: BookingSuccess) => void;
}

/**
 * Open the booker in a centered modal overlay. Framework-agnostic (plain DOM),
 * so it works outside React too. Returns a `close()` handle.
 */
export function openDayOtterPopup(opts: PopupOptions): { close: () => void } {
  const src = buildEmbedUrl(opts);
  let origin = "";
  try {
    origin = new URL(src).origin;
  } catch {
    /* ignore */
  }

  const overlay = document.createElement("div");
  overlay.setAttribute("data-dayotter-overlay", "");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;background:rgba(15,15,20,.55);display:flex;align-items:center;justify-content:center;padding:16px";

  const box = document.createElement("div");
  box.style.cssText =
    "position:relative;background:#fff;border-radius:14px;overflow:hidden;width:100%;max-width:820px;height:88vh;box-shadow:0 20px 60px rgba(0,0,0,.3)";

  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = "DayOtter booking";
  frame.setAttribute("allow", "payment");
  frame.style.cssText = "border:0;width:100%;height:100%";

  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText =
    "position:absolute;top:8px;right:10px;z-index:1;border:0;background:rgba(0,0,0,.06);border-radius:999px;width:30px;height:30px;font-size:20px;line-height:1;cursor:pointer";

  function close() {
    window.removeEventListener("message", onMessage);
    overlay.remove();
  }
  function onMessage(e: MessageEvent<DayOtterMessage>) {
    if (origin && e.origin !== origin) return;
    if (e.source !== frame.contentWindow) return;
    if (e.data?.type === "dayotter:booking" && e.data.uid && e.data.url) {
      opts.onBookingSuccessful?.({ uid: e.data.uid, url: e.data.url });
    }
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener("message", onMessage);

  box.appendChild(closeBtn);
  box.appendChild(frame);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return { close };
}

export interface DayOtterButtonProps extends PopupOptions {
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A button that opens the booker in a modal popup. */
export function DayOtterButton({
  children = "Book a time",
  className,
  style,
  onBookingSuccessful,
  handle,
  slug,
  baseUrl,
  theme,
  primaryColor,
  hideDetails,
}: DayOtterButtonProps) {
  const open = useCallback(() => {
    openDayOtterPopup({
      handle,
      slug,
      baseUrl,
      theme,
      primaryColor,
      hideDetails,
      onBookingSuccessful,
    });
  }, [handle, slug, baseUrl, theme, primaryColor, hideDetails, onBookingSuccessful]);
  return (
    <button type="button" onClick={open} className={className} style={style}>
      {children}
    </button>
  );
}
