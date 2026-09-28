import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@pdf-lib/fontkit",
  ],
  outputFileTracingIncludes: {
    "/api/laptops/*/accountability-form": [
      "./lib/pdf/fonts/**/*",
      "./public/ardent-logo.png",
    ],
  },
};

export default nextConfig;
