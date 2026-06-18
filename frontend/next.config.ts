import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone bundle for systemd + Node on the VPS.
  output: "standalone",
  // POS + admin live under /pos so the domain root stays free for the website.
  basePath: "/pos",
};

export default nextConfig;
