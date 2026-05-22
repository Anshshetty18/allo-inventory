import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Ensure Prisma doesn't bundle server-side code in client bundles
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
