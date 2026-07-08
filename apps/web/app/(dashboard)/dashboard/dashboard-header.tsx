"use client"

import { can } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"
import { Button } from "@workspace/ui/components/button"
import { Plus, ShieldCheck } from "lucide-react"
import Link from "next/link"

export function DashboardHeader() {
  const { user, role } = useCurrentUser()
  const firstName = user?.name?.split(" ")[0] ?? "there"

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Welcome back, {firstName}</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href="/surveys/new">
            <Plus className="h-4 w-4" aria-hidden />
            New Survey
          </Link>
        </Button>
        {can(role, "qc.review") && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/qc">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              QC Queue
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
