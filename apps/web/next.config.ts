import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@atticus/core", "@atticus/db"],
  cacheComponents: true,
  partialPrefetching: true,
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
