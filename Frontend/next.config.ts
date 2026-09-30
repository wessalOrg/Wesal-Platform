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
};

export default nextConfig;
