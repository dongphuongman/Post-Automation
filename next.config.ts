import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // build gọn cho Docker: sinh .next/standalone (server.js + deps tối thiểu)
  devIndicators: false, // tắt nút Next.js dev tools (logo "N" góc dưới)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
