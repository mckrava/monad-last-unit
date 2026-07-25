import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Swarm deploy runs the self-contained .next/standalone server (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
