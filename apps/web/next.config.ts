import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@workspace/ui", "recharts", "framer-motion"],
  },
  ...(process.env.NODE_ENV === "production" && {
    reactStrictMode: true,
  }),
}

export default nextConfig
