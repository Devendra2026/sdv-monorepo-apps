"use client"

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero"
import { GlassCard } from "@/components/design-system/glass-card"
import { MetricCard } from "@/components/design-system/metric-card"
import { PageTransition } from "@/components/design-system/motion"
import { RoleGate } from "@/components/shared/role-gate"
import { SurveyPageSkeleton } from "@/components/shared/survey-route-skeleton"
import { TablePagination } from "@/components/shared/table-pagination"
import { SurveyRegistryTable } from "@/components/surveys/survey-registry-table"
import { useWardsForMunicipality } from "@/hooks/masters/useMasters"
import { useSurveyListPaginated } from "@/hooks/surveys/useSurveys"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { enrichServerSurveyWardStats } from "@/lib/surveys/ward-stats"
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { Button } from "@workspace/ui/components/button"
import { useQuery as useConvexQuery } from "convex/react"
import { ArrowLeft, CheckCircle2, FileEdit, Home, Send } from "lucide-react"
import Link from "next/link"
import { use, useMemo, useState } from "react"

function SurveyWardDetailContent({ wardNo, municipalityId }: { wardNo: string; municipalityId?: string }) {
  const decodedWard = decodeURIComponent(wardNo)
  const [pageSize, setPageSize] = useState(20)
  const nowMs = useClientNowMs()
  const ready = useConvexAuthReady()

  const listFilters = useMemo(
    () => ({
      wardNo: decodedWard,
      municipalityId,
    }),
    [decodedWard, municipalityId]
  )

  const { surveys, isLoading, pageNumber, canGoPrev, canGoNext, goNext, goPrev } = useSurveyListPaginated(
    listFilters,
    pageSize
  )

  const serverStats = useConvexQuery(
    api.surveys.queries.commandCenterStats,
    ready && nowMs !== undefined
      ? {
          wardNo: decodedWard,
          municipalityId: municipalityId as Id<"municipalities"> | undefined,
          nowMs,
        }
      : "skip"
  )

  const wards = useWardsForMunicipality(municipalityId)
  const wardLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wards ?? []) map.set(w.wardNo, w.name)
    return map
  }, [wards])

  const wardRow = useMemo(() => {
    if (!serverStats?.wardStats) return undefined
    return enrichServerSurveyWardStats(serverStats.wardStats, wardLabels)[0]
  }, [serverStats, wardLabels])

  const wardLabel = wards?.find((w) => w.wardNo === decodedWard)?.name
  const title = wardLabel ? `Ward ${decodedWard} — ${wardLabel}` : `Ward ${decodedWard}`
  const pageStart = (pageNumber - 1) * pageSize

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm" className="cursor-pointer rounded-xl">
          <Link href="/surveys">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Command Center
          </Link>
        </Button>
      </div>

      <ExecutiveHero
        eyebrow="Field Surveys"
        title={title}
        description="Ward-level survey metrics and property records."
        gradient="brand"
      />

      {wardRow ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Properties" value={wardRow.total.toLocaleString()} icon={Home} tone="info" />
          <MetricCard label="Draft Surveys" value={wardRow.drafts.toLocaleString()} icon={FileEdit} tone="default" />
          <MetricCard label="Submitted" value={wardRow.submitted.toLocaleString()} icon={Send} tone="info" />
          <MetricCard
            label="QC Approved"
            value={wardRow.qcApproved.toLocaleString()}
            icon={CheckCircle2}
            tone="success"
          />
        </div>
      ) : serverStats === undefined ? (
        <SurveyPageSkeleton variant="ward" />
      ) : null}

      <GlassCard padding="none" className="overflow-hidden border-indigo-500/15">
        <div className="border-b border-indigo-500/20 px-5 py-4">
          <SectionHeader title="Survey records" description={`Ward ${decodedWard} property list`} />
        </div>
        <div className="p-4">
          <SurveyRegistryTable rows={isLoading ? undefined : surveys} pageStart={pageStart} showSurveyor />
        </div>
      </GlassCard>

      <TablePagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        itemCount={surveys?.length ?? 0}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={goPrev}
        onNext={goNext}
        pageSizeOptions={[...QC_TABLE_PAGE_SIZE_OPTIONS]}
        onPageSizeChange={setPageSize}
      />
    </PageTransition>
  )
}

export default function SurveyWardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ wardNo: string }>
  searchParams: Promise<{ municipalityId?: string }>
}) {
  const { wardNo } = use(params)
  const { municipalityId } = use(searchParams)

  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewOwn", "surveys.viewAssigned", "surveys.viewAll"]}
      deniedDescription="Ward reports require survey module access."
      redirectTo="/qc"
    >
      <SurveyWardDetailContent wardNo={wardNo} municipalityId={municipalityId} />
    </RoleGate>
  )
}
