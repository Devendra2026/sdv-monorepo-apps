import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/__clerk(.*)"])
const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"])

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname

  if (pathname === "/") {
    const { isAuthenticated } = await auth()
    return NextResponse.redirect(new URL(isAuthenticated ? "/dashboard" : "/sign-in", req.url))
  }

  if (isPublicRoute(req)) {
    if (isAuthRoute(req)) {
      const { isAuthenticated } = await auth()
      if (isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    }
    return
  }

  await auth.protect()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path
    "/__clerk/(.*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
