import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, ".."),        // allow files outside web/
  outputFileTracingIncludes: {                                   // bundle the data files read at runtime
    "/**": [
      "../examples/**/*",
      "../twilio_example/**/*",
      "../golden_list/**/*.json",
      "../pipeline/taxonomy/**/*.json",
    ],
  },
  serverExternalPackages: ["@electric-sql/pglite"],              // local dev database (lib/db); load from node_modules, not bundled
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
