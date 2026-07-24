"use client"

import { PageTransition } from "@/components/design-system/motion"
import { TablePagination } from "@/components/shared/table-pagination"
import { SurveyExcelActions } from "@/components/surveys/survey-excel-actions"
import { SurveyRegistryHero, SurveyScopeBanner } from "@/components/surveys/survey-queue-sections"
import { SurveyReassignDialog } from "@/components/surveys/survey-reassign-dialog"
import { SurveyReviewRegistry } from "@/components/surveys/survey-registry-sections"
import { useSurveyQueue } from "@/hooks/surveys/useSurveyQueue"
import { useHasCapability } from "@/hooks/use-capability"
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { Button } from "@workspace/ui/components/button"
import type { FunctionReturnType } from "convex/server"
import { ArrowRightLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

export function SurveyRegistryContent({
  seedRegistryPage,
  nowMs,
}: {
  seedRegistryPage?: FunctionReturnType<typeof api.surveys.queries.listPaginated>
  nowMs?: number
}) {
  const searchParams = useSearchParams()
  const wardFromUrl = searchParams.get("wardNo") ?? undefined
  const muniFromUrl = searchParams.get("municipalityId") ?? undefined
  const districtFromUrl = searchParams.get("districtId") ?? undefined
  const tabFromUrl = searchParams.get("tab") ?? undefined

  const canReassign = useHasCapability("surveys.reassign")
  const [reassignOpen, setReassignOpen] = useState(false)

  const {
    scope,
    activeTab,
    pageNumber,
    pageSize,
    pageStart,
    isLoading,
    authFailed,
    stats,
    filteredCount,
    scopeTruncated,
    pagedRows,
    surveyorSearch,
    canViewAll,
    patchScope,
    handleSurveyorSearchChange,
    handleTabChange,
    handlePageSizeChange,
    canGoPrev,
    canGoNext,
    goNext,
    goPrev,
  } = useSurveyQueue({
    mode: "registry",
    initialTab: tabFromUrl ?? "all",
    seedRegistryPage,
    seedNowMs: nowMs,
  })

  useEffect(() => {
    if (!wardFromUrl && !muniFromUrl && !districtFromUrl) return
    patchScope({
      wardNo: wardFromUrl ?? scope.wardNo,
      municipalityId: muniFromUrl ?? scope.municipalityId,
      districtId: districtFromUrl ?? scope.districtId,
    })
  }, [wardFromUrl, muniFromUrl, districtFromUrl, patchScope, scope.districtId, scope.municipalityId, scope.wardNo])

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      handleTabChange(tabFromUrl)
    }
  }, [tabFromUrl, activeTab, handleTabChange])

  const listFilters = useMemo(
    () => ({
      wardNo: scope.wardNo,
      districtId: scope.districtId,
      municipalityId: scope.municipalityId,
      searchTerm: surveyorSearch.trim() || undefined,
    }),
    [scope, surveyorSearch]
  )

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <SurveyRegistryHero />
      <SurveyScopeBanner scope={scope} />

      {authFailed ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Sign in to load field survey data. If you are already signed in, refresh the page or check that the site can
          reach the API.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SurveyExcelActions filters={listFilters} disabled={isLoading || authFailed} canImport={canViewAll} />
        {canReassign && (
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer rounded-xl"
            onClick={() => setReassignOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden /> Reassign drafts
          </Button>
        )}
        <Button asChild className="cursor-pointer rounded-xl">
          <Link href="/surveys/new">
            <Plus className="h-4 w-4" aria-hidden /> New survey
          </Link>
        </Button>
      </div>

      <SurveyReviewRegistry
        stats={stats}
        activeTab={activeTab}
        filteredCount={filteredCount}
        isLoading={isLoading}
        rows={pagedRows}
        pageStart={pageStart}
        surveyorSearch={surveyorSearch}
        onSurveyorSearchChange={handleSurveyorSearchChange}
        onTabChange={handleTabChange}
        showSurveyor={canViewAll}
      />

      {scopeTruncated ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Results are limited for this broad search or date filter. Narrow district/ULB/ward filters to see the full
          list.
        </p>
      ) : null}

      <TablePagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        itemCount={pagedRows?.length ?? 0}
        totalCount={filteredCount}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={goPrev}
        onNext={goNext}
        pageSizeOptions={[...QC_TABLE_PAGE_SIZE_OPTIONS]}
        onPageSizeChange={handlePageSizeChange}
      />

      <SurveyReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        scope={{
          districtId: scope.districtId,
          municipalityId: scope.municipalityId,
          wardNo: scope.wardNo,
        }}
      />
    </PageTransition>
  )
}
