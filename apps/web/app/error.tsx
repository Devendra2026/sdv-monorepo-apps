"use client"

import { Button } from "@workspace/ui/components/button"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const searchParams = useSearchParams()
  const showDebug = process.env.NODE_ENV === "development" || searchParams.get("debug") === "1"

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
      <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. You can retry or return to the dashboard.
      </p>
      {showDebug && (
        <p className="max-w-lg rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-left font-mono text-xs break-all text-muted-foreground">
          {error.message}
          {error.digest ? `\nDigest: ${error.digest}` : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
