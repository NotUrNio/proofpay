import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  // Ensure Next.js 15.1+ always emits <title> and <meta name="description"> synchronously
  // inside <head> rather than streaming metadata into <body> on dynamic routes.
  htmlLimitedBots: /.*/,
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
