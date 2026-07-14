import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DayOtter",
    short_name: "DayOtter",
    description: "The AI-native, open-source scheduling platform.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#6743e6",
    icons: [
      { src: "/brand/dayotter-icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/dayotter-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
