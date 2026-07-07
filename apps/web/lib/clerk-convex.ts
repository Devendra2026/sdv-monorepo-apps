/**
 * Clerk JWT template name for Convex server/client auth.
 * Must match the template in Clerk Dashboard (Convex integration creates `convex`)
 * and `applicationID` in packages/backend/convex/auth.config.ts.
 *
 * Setup: https://dashboard.clerk.com/apps/setup/convex
 */
export const CLERK_CONVEX_JWT_TEMPLATE = "convex" as const
