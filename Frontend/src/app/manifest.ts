import type { MetadataRoute } from "next";

/**
 * Web App Manifest for Wesal (وصال).
 * Served by Next.js at /manifest.webmanifest.
 * Brand: maroon #c17b7f on cream #fcfbf9 (see globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "وصال — منصة حجز قاعات الأفراح في غزة",
    short_name: "وصال",
    description: "منصة حجز قاعات الأفراح في غزة — ابحث، قارن، واحجز بثقة.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    theme_color: "#c17b7f",
    background_color: "#fcfbf9",
    categories: ["business", "lifestyle", "weddings"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "تصفح القاعات",
        url: "/halls",
        description: "استكشف قاعات الأفراح المعتمدة على وصال.",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
