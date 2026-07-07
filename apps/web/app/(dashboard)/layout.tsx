"use client"

import { MotionProvider, PageTransition } from "@/components/design-system/motion"
import { DashboardChromeSkeleton } from "@/components/layout/dashboard-chrome-skeleton"
import { ModuleGuard } from "@/components/layout/module-guard"
import { Sidebar } from "@/components/layout/Sidebar"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Topbar } from "@/components/layout/Topbar"
import { useCurrentUser } from "@/lib/sessions"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Authenticated, AuthLoading, AuthRefreshing } from "convex/react"
import { Clock, RefreshCw, ShieldX } from "lucide-react"

function AccountGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isPending, isDisabled, isProvisioning, provisionFailed, retryProvision } = useCurrentUser()

  if (isLoading) {
    return <DashboardChromeSkeleton />
  }

  if (!user) {
    if (provisionFailed) {
      return (
        <StatusScreen
          icon={RefreshCw}
          tone="text-warning"
          title="Account setup delayed"
          body="We couldn't finish setting up your account. This usually resolves when the Clerk webhook completes. Try again or contact your administrator."
          action={
            <Button type="button" variant="default" className="mt-4" onClick={retryProvision}>
              Retry setup
            </Button>
          }
        />
      )
    }

    return (
      <>
        <DashboardChromeSkeleton />
        <span className="sr-only">{isProvisioning ? "Setting up account" : "Loading account"}</span>
      </>
    )
  }

  if (isDisabled) {
    return (
      <StatusScreen
        icon={ShieldX}
        tone="text-destructive"
        title="Account disabled"
        body="This account has been disabled by an administrator. Contact your municipal admin if you believe this is an error."
      />
    )
  }

  if (isPending) {
    return (
      <StatusScreen
        icon={Clock}
        tone="text-warning"
        title="Awaiting approval"
        body={`Your account (${user.email}) is registered and waiting for an administrator to approve it and assign your role and municipality. You'll be notified once approved.`}
      />
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[margin,padding] duration-300 ease-in-out">
          <Topbar />
          <main className="premium-scrollbar theme-transition bg-shell min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
            <MotionProvider>
              <PageTransition className="mx-auto w-full max-w-360 space-y-6 p-4 pb-10 sm:p-5 lg:space-y-8 lg:p-8 lg:pb-12">
                <ModuleGuard>{children}</ModuleGuard>
              </PageTransition>
            </MotionProvider>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

function StatusScreen({
  icon: Icon,
  tone,
  title,
  body,
  action,
}: {
  icon: React.ElementType
  tone: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4">
      <div className="max-w-md text-center">
        <Icon className={`mx-auto mb-4 h-10 w-10 ${tone}`} />
        <h1 className="font-display text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action}
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded || !isSignedIn) {
    return <DashboardChromeSkeleton />
  }

  return (
    <>
      <AuthLoading>
        <DashboardChromeSkeleton />
      </AuthLoading>
      <AuthRefreshing>
        <DashboardChromeSkeleton />
      </AuthRefreshing>
      <Authenticated>
        <AccountGate>{children}</AccountGate>
      </Authenticated>
    </>
  )
}
