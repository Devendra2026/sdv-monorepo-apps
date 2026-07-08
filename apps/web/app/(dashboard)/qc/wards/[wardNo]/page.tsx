"use client"

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero"
import { GlassCard } from "@/components/design-system/glass-card"
import { MetricCard } from "@/components/design-system/metric-card"
import { PageTransition } from "@/components/design-system/motion"
import { QcDataTable } from "@/components/qc/qc-data-table"
import { RoleGate } from "@/components/shared/role-gate"
import { TablePagination } from "@/components/shared/table-pagination"
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters"
import { useSurveyList, useSurveyListPaginated } from "@/hooks/surveys/useSurveys"
import { activeParcelSiblingPool, buildParcelSiblingIndex } from "@/lib/qc/parcel-siblings"
import { computeQcWardStats } from "@/lib/qc/ward-stats"
import { buildUlbCodeMap } from "@/lib/survey/resolve-display-property-id"
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination"
import { Button } from "@workspace/ui/components/button"
import { ArrowLeft, CheckCircle2, Clock3, FileText, MapPin, Receipt, Table2 } from "lucide-react"
import Link from "next/link"
import { use, useMemo, useState } from "react"

function QcWardReportContent({
  params,
  searchParams,
}: {
  params: Promise<{ wardNo: string }>
  searchParams: Promise<{ municipalityId?: string; tab?: string }>
}) {
  const { wardNo } = use(params)
  const { municipalityId, tab } = use(searchParams)
  const decodedWard = decodeURIComponent(wardNo)
  const showDemand = tab === "demand"
  const [pageSize, setPageSize] = useState(20)

  const listFilters = useMemo(
    () => ({
      wardNo: decodedWard,
      municipalityId,
      ...(showDemand ? { qcStatus: "approved" as const } : {}),
    }),
    [decodedWard, municipalityId, showDemand]
  )

  const { surveys, isLoading, pageNumber, canGoPrev, canGoNext, goNext, goPrev } = useSurveyListPaginated(
    listFilters,
    pageSize
  )

  const aggregateSurveys = useSurveyList({
    wardNo: decodedWard,
    municipalityId: municipalityId as string | undefined,
    limit: 300,
  })

  const wards = useWardsForMunicipality(municipalityId)
  const { masters } = useMasters()
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs])
  const propertyUses = masters?.propertyUses

  const wardLabel = wards?.find((w) => w.wardNo === decodedWard)?.name

  const wardRow = useMemo(
    () => computeQcWardStats((aggregateSurveys ?? []) as Parameters<typeof computeQcWardStats>[0])[0],
    [aggregateSurveys]
  )

  const listRows = useMemo(() => {
    const rows = surveys ?? []
    if (showDemand) return rows
    return rows.filter((r) => r.status !== "draft")
  }, [surveys, showDemand])

  const siblingIndex = useMemo(() => {
    const pool = activeParcelSiblingPool((aggregateSurveys ?? []) as Parameters<typeof activeParcelSiblingPool>[0])
    return buildParcelSiblingIndex(pool)
  }, [aggregateSurveys])

  const title = wardLabel ? `Ward ${decodedWard} — ${wardLabel}` : `Ward ${decodedWard}`

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <Button asChild variant="outline" size="sm" className="w-fit cursor-pointer rounded-xl">
        <Link href="/qc">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Command Center
        </Link>
      </Button>

      <ExecutiveHero
        eyebrow="Ward Report"
        title={title}
        description={
          showDemand
            ? "Approved properties — open demand notices for tax assessment"
            : "QC summary and property records for this ward"
        }
        icon={MapPin}
        gradient="amber"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant={showDemand ? "outline" : "default"}
              size="sm"
              className="cursor-pointer rounded-xl"
            >
              <Link
                href={`/qc/wards/${encodeURIComponent(decodedWard)}${municipalityId ? `?municipalityId=${municipalityId}` : ""}`}
              >
                <FileText className="h-4 w-4" aria-hidden /> QC Report
              </Link>
            </Button>
            <Button
              asChild
              variant={showDemand ? "default" : "outline"}
              size="sm"
              className="cursor-pointer rounded-xl"
            >
              <Link
                href={`/qc/wards/${encodeURIComponent(decodedWard)}?tab=demand${municipalityId ? `&municipalityId=${municipalityId}` : ""}`}
              >
                <Receipt className="h-4 w-4" aria-hidden /> Demand Notices
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="cursor-pointer rounded-xl">
              <Link
                href={`/qc/registry?wardNo=${encodeURIComponent(decodedWard)}${municipalityId ? `&municipalityId=${municipalityId}` : ""}`}
              >
                <Table2 className="h-4 w-4" aria-hidden /> Registry
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="QC Pending" value={(wardRow?.pending ?? 0).toLocaleString()} icon={Clock3} tone="warning" />
        <MetricCard
          label="QC Approved"
          value={(wardRow?.approved ?? 0).toLocaleString()}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          label="Total Properties"
          value={(wardRow?.total ?? 0).toLocaleString()}
          icon={MapPin}
          tone="default"
        />
      </div>

      <GlassCard padding="none" className="overflow-hidden border-amber-500/15">
        <div className="border-b border-amber-500/20 px-5 py-4">
          <SectionHeader
            title={showDemand ? "Demand Notice Register" : "Property QC Register"}
            description={
              showDemand
                ? `${wardRow?.approved ?? 0} approved properties eligible for demand notice`
                : `Page ${pageNumber} · ward properties`
            }
          />
        </div>
        <div className="p-4">
          <QcDataTable
            rows={isLoading ? undefined : listRows}
            pageStart={(pageNumber - 1) * pageSize}
            hrefBase="/qc"
            siblingIndex={siblingIndex}
            propertyUses={propertyUses}
            ulbCodes={ulbCodes}
            showSurveyor
            showDemandActions={showDemand}
            emptyTitle="No records"
            emptyDescription="No properties match this ward view."
          />
        </div>
      </GlassCard>

      <TablePagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        itemCount={listRows.length}
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

export default function QcWardReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ wardNo: string }>
  searchParams: Promise<{ municipalityId?: string; tab?: string }>
}) {
  return (
    <RoleGate mode="page" capability="qc.review" deniedDescription="Ward reports require QC access.">
      <QcWardReportContent params={params} searchParams={searchParams} />
    </RoleGate>
  )
}
