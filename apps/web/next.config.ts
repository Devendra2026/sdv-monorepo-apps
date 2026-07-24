import type { NextConfig } from "next"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.join(appRoot, "../..")

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.sdvedutech.in https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://api.sdvedutech.in wss://api.sdvedutech.in https://site.sdvedutech.in https://accounts.sdvedutech.in https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com",
      "frame-src 'self' https://accounts.sdvedutech.in https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
]

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  })
}

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  experimental: {
    optimizePackageImports: ["lucide-react", "@workspace/ui", "recharts", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  ...(process.env.NODE_ENV === "production" && {
    reactStrictMode: true,
  }),
}

export default nextConfig
