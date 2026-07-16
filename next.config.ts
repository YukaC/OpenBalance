import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR when opening the app via LAN IP
  allowedDevOrigins: ["192.168.0.233", "127.0.0.1"],
};

export default nextConfig;
