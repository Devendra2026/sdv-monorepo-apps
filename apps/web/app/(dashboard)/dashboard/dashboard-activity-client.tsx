"use client"

import { DashboardActivityContentSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { ActivityFeed } from "@/components/design-system/activity-feed"
import { DataSection } from "@/components/shared/data-section"
import { buildActivityFeed, type RecentActivitySurvey } from "@/lib/activity-feed"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Activity } from "lucide-react"
import { useMemo } from "react"

export function DashboardActivityView({ recentSurveys }: { recentSurveys: RecentActivitySurvey[] | undefined }) {
  const activity = useMemo(() => (recentSurveys ? buildActivityFeed(recentSurveys) : []), [recentSurveys])
  const ready = recentSurveys !== undefined

  return (
    <section aria-labelledby="activity-heading">
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
            <CardTitle id="activity-heading" className="text-sm font-semibold tracking-tight">
              Recent Activity
            </CardTitle>
          </div>
          <CardDescription className="text-xs">Recent survey and QC events</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <DataSection ready={ready} skeleton={<DashboardActivityContentSkeleton />} ariaLabel="Recent activity">
            {activity.length === 0 ? (
              <DashboardEmptyState
                compact
                icon={Activity}
                title="No recent activity"
                description="Survey and QC events in your scope will appear here."
              />
            ) : (
              <ActivityFeed items={activity} loading={false} bare />
            )}
          </DataSection>
        </CardContent>
      </Card>
    </section>
  )
}
