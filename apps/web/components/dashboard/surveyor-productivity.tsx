"use client"

import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Users } from "lucide-react"

export type SurveyorProductivityRow = {
  name: string
  submitted: number
  approved: number
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function SurveyorProductivity({ data }: { data: SurveyorProductivityRow[] }) {
  const maxSubmitted = data.length > 0 ? Math.max(...data.map((d) => d.submitted), 1) : 1

  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="text-sm font-semibold tracking-tight">Surveyor Productivity</CardTitle>
        <CardDescription className="text-xs">Top surveyors by completed volume</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {data.length === 0 ? (
          <DashboardEmptyState
            compact
            icon={Users}
            title="No surveyor activity yet"
            description="Surveyor rankings will appear once surveys are submitted in your scope."
          />
        ) : (
          <ul className="space-y-3" role="list" aria-label="Surveyor productivity rankings">
            {data.map((surveyor, index) => {
              const progressValue =
                surveyor.submitted > 0 ? Math.round((surveyor.approved / surveyor.submitted) * 100) : 0
              const barValue = Math.round((surveyor.submitted / maxSubmitted) * 100)

              return (
                <li key={`${surveyor.name}-${index}`} className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                      #{index + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px] font-medium">{getInitials(surveyor.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{surveyor.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {surveyor.submitted.toLocaleString()} submitted
                        <span className="mx-1 text-border">·</span>
                        {surveyor.approved.toLocaleString()} approved
                      </p>
                    </div>
                  </div>
                  <div className="pl-12">
                    <Progress
                      value={barValue}
                      className="h-1"
                      aria-label={`${surveyor.name}: ${progressValue}% approval rate`}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
