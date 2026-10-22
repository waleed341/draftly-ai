import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Hide the Next.js dev button in the corner during `npm run dev`.
  devIndicators: false,
};

export default nextConfig;
