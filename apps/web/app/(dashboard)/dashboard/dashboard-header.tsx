"use client"

import { can } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"
import { fmtDay } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Plus, ShieldCheck } from "lucide-react"
import Link from "next/link"

const TREND_DAYS = 30

function formatReportingPeriod(nowMs: number): string {
  const end = new Date(nowMs)
  const start = new Date(nowMs)
  start.setDate(start.getDate() - (TREND_DAYS - 1))
  return `Last ${TREND_DAYS} days · ${fmtDay(start.getTime())} – ${fmtDay(end.getTime())}`
}

export function DashboardHeader({ nowMs }: { nowMs: number }) {
  const { user, role } = useCurrentUser()
  const firstName = user?.name?.split(" ")[0] ?? "there"
  const municipality = user?.municipality?.name

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Survey Operations</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Welcome back, {firstName}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {municipality
            ? `Operations overview for ${municipality} — pipeline health, team capacity, and QC throughput.`
            : "Operations overview across your assigned scope — pipeline health, team capacity, and QC throughput."}
        </p>
        <p className="text-xs text-muted-foreground">{formatReportingPeriod(nowMs)}</p>
      </div>
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
