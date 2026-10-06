import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    // Next ≥16 refuses to optimize upstream images whose host resolves to a private
    // IP (SSRF guard). The local wesal-api serves `/uploads` from localhost:5298, so
    // hall covers rendered through next/image 400'd in development only. Production
    // hosts (Render / Taqat) are public and stay protected.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "5080",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "5298",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5080",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5298",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "wesal-platform.onrender.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.apps.taqat.academy",
        pathname: "/**",
      },
    ],
  },
  // Baseline hardening headers (production-safe; no CSP: Next.js inline boot
  // scripts require unsafe-inline, so CSP stays deferred until a nonce strategy
  // is adopted — see the hardening report).
  async headers() {
    return [
      // Service Worker must revalidate on every load so new deployments
      // activate immediately instead of serving a stale bundle.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/offline.html",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
