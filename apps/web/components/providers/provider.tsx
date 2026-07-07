"use client"

import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { convex } from "@/lib/convex"
import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { Toaster } from "@workspace/ui/components/sonner"
import { ThemeProvider } from "./theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
              <TooltipProvider>{children}</TooltipProvider>
            </ThemeProvider>
          </div>
          <Toaster position="top-right" richColors closeButton />
        </div>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
