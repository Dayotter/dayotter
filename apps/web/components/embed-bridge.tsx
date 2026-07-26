"use client";

import { useEffect } from "react";

/**
 * Client bridge for the embed iframe: applies the requested theme and posts the
 * document height to the parent window whenever it changes, so the host page's
 * embed.js / React SDK can auto-resize the frame. Renders nothing.
 */
export function EmbedBridge({ theme }: { theme: "light" | "dark" | "auto" }) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "light") root.classList.remove("dark");
    // "auto" leaves whatever the app shell resolved from prefers-color-scheme.

    const post = () => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      window.parent?.postMessage({ type: "dayotter:height", height }, "*");
    };

    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.documentElement);
    window.addEventListener("load", post);
    // A couple of delayed posts catch late layout (fonts, async content).
    const t1 = window.setTimeout(post, 300);
    const t2 = window.setTimeout(post, 1200);
    return () => {
      ro.disconnect();
      window.removeEventListener("load", post);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [theme]);

  return null;
}
