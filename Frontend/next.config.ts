import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
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
        hostname: "127.0.0.1",
        port: "5080",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
