import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["libheif-js"],
  outputFileTracingIncludes: {
    "/api/*": [
      "./node_modules/libheif-js/wasm-bundle.js",
      "./node_modules/libheif-js/libheif-wasm/libheif-bundle.js",
      "./node_modules/libheif-js/package.json",
    ],
  },
  distDir: process.env.NATIVEYARD_DIST_DIR || ".next",
  outputFileTracingExcludes: { "/*": ["./.local/**"] },
  turbopack: { root: process.cwd() },
};
export default nextConfig;
