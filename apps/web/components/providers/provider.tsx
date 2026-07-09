"use client"

import { convex } from "@/lib/convex"
import { ClerkProvider, useAuth } from "@clerk/nextjs"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { ThemeProvider } from "./theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <TooltipProvider>{children}</TooltipProvider>
            </ThemeProvider>
          </div>
          <Toaster position="top-right" richColors closeButton />
        </div>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
