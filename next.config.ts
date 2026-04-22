import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.31.138"],
};

export default nextConfig;
