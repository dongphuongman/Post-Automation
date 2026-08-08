import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // tắt nút Next.js dev tools (logo "N" góc dưới)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
