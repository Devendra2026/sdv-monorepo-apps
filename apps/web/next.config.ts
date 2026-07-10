import type { NextConfig } from "next"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.join(appRoot, "../..")

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  experimental: {
    optimizePackageImports: ["lucide-react", "@workspace/ui", "recharts", "framer-motion"],
  },
  ...(process.env.NODE_ENV === "production" && {
    reactStrictMode: true,
  }),
}

export default nextConfig
