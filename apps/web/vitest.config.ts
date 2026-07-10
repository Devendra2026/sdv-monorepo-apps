import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@workspace/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@workspace/convex": path.resolve(__dirname, "../../packages/backend/convex"),
      "@workspace/schemas": path.resolve(__dirname, "../../packages/schemas/src"),
    },
  },
  test: {
    environment: "node",
  },
})
