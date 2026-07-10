"use client"

import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { useEffect } from "react"

export default function SurveysError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[surveys] route error", error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
      <h2 className="font-display text-xl font-semibold text-foreground">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We could not load this survey view. Try again, or return to the survey list.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" className="cursor-pointer rounded-xl" onClick={reset}>
          Try again
        </Button>
        <Button type="button" className="cursor-pointer rounded-xl" asChild>
          <Link href="/surveys/registry">Go to registry</Link>
        </Button>
      </div>
    </div>
  )
}
