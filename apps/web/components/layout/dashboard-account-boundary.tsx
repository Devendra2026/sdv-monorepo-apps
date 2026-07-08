"use client"

import { MotionProvider, PageTransition } from "@/components/design-system/motion"
import { DashboardMainSkeleton } from "@/components/layout/dashboard-main-skeleton"
import { ModuleGuard } from "@/components/layout/module-guard"
import { useCurrentUser } from "@/lib/current-user-context"
import { Button } from "@workspace/ui/components/button"
import { Clock, RefreshCw, ShieldX } from "lucide-react"

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

export function DashboardAccountBoundary({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isPending, isDisabled, isProvisioning, provisionFailed, retryProvision } = useCurrentUser()

  if (isLoading && user === undefined) {
    return <DashboardMainSkeleton />
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
        <DashboardMainSkeleton />
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
    <MotionProvider>
      <PageTransition className="mx-auto w-full max-w-360 space-y-6 p-4 pb-10 sm:p-5 lg:space-y-8 lg:p-8 lg:pb-12">
        <ModuleGuard>{children}</ModuleGuard>
      </PageTransition>
    </MotionProvider>
  )
}
