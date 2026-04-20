import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["apify-client", "got", "got-scraping"],
};

export default nextConfig;
