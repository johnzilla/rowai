import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Disable in dev to avoid Turbopack conflict; enable only in production build
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Add empty turbopack config to suppress webpack vs turbopack warning during build
  turbopack: {},
};

export default withSerwist(nextConfig);
