import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Event cover uploads go through a server action (default cap 1 MB). Covers are shrunk in the
    // browser first; this allows up to the 4 MB server-side cap plus form overhead, and matches
    // Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
