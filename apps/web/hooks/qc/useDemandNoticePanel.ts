"use client"

import type { FilterState } from "@/components/surveys/survey-filters"
import { useMasters } from "@/hooks/masters/useMasters"
import { useTaxRatesForMunicipality } from "@/hooks/qc/useTaxRatesForMunicipality"
import { useSurveyListPaginated } from "@/hooks/surveys/useSurveys"
import { estimateDemandAssessment, formatInr } from "@/lib/qc/demand-estimate"
import { computeDemandNotice } from "@/lib/qc/demand-notice"
import { resolveAssessableSqft } from "@/lib/qc/qc-report-demand"
import { formatReportDocumentDate, reportDocumentTimestamp } from "@/lib/qc/report-dates"
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id"
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import type { FloorRow, SurveyListItem } from "@workspace/schemas"
import { useQuery } from "convex/react"
import { useMemo, useState } from "react"

export type DemandRegisterRow = {
  surveyId: string
  propertyId: string
  ownerName: string
  wardNo: string
  parcelNo: string
  assessableSqft: number
  annualDemand: number
  annualDemandLabel: string
  survey: SurveyListItem
}

export function useDemandNoticePanel() {
  const [filters, setFilters] = useState<FilterState>({})
  const [pageSize, setPageSize] = useState<number>(QC_TABLE_PAGE_SIZE_OPTIONS[1] ?? 20)
  const { masters } = useMasters()
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs])
  const reportDateMs = reportDocumentTimestamp()
  const reportDateLabel = formatReportDocumentDate(reportDateMs)
  const selectedMunicipalityId = filters.municipalityId as Id<"municipalities"> | undefined

  const paginated = useSurveyListPaginated(
    {
      qcStatus: "approved",
      districtId: filters.districtId,
      municipalityId: filters.municipalityId,
      wardNo: filters.wardNo,
    },
    pageSize
  )

  const surveyIds = useMemo(() => (paginated.surveys ?? []).map((row) => row._id as Id<"surveys">), [paginated.surveys])
  const groupedFloors = useQuery(api.floors.listForSurveys, surveyIds.length > 0 ? { surveyIds } : "skip")
  const { rateConfig, ratesLoading } = useTaxRatesForMunicipality(selectedMunicipalityId)

  const floorsBySurvey = useMemo(() => {
    const bySurvey = new Map<string, FloorRow[]>()
    for (const group of groupedFloors ?? []) {
      bySurvey.set(group.surveyId, group.floors as FloorRow[])
    }
    return bySurvey
  }, [groupedFloors])

  const rows = useMemo((): DemandRegisterRow[] => {
    return (paginated.surveys ?? []).map((survey) => {
      const floors = floorsBySurvey.get(survey._id) ?? []
      const assessableSqft = resolveAssessableSqft({
        plotSqft: survey.plotSqft,
        plinthSqft: survey.plinthSqft,
        floors,
      })

      let annualDemand = 0
      if (filters.municipalityId && rateConfig !== undefined && floors.length > 0) {
        const notice = computeDemandNotice(survey as any, floors, masters ?? undefined, rateConfig)
        annualDemand = notice.totalAnnualDemand
      } else if (filters.municipalityId && assessableSqft > 0) {
        annualDemand = estimateDemandAssessment(survey, assessableSqft).total
      }

      const ownerName = survey.respondentName || survey.owners?.[0]?.name || "—"
      const propertyId = resolveDisplayPropertyId(survey, ulbCodes) ?? survey.propertyId ?? "—"
      return {
        surveyId: survey._id,
        propertyId,
        ownerName,
        wardNo: survey.wardNo || "—",
        parcelNo: survey.parcelNo || "—",
        assessableSqft,
        annualDemand,
        annualDemandLabel: annualDemand > 0 ? formatInr(annualDemand) : "—",
        survey,
      }
    })
  }, [filters.municipalityId, floorsBySurvey, masters, paginated.surveys, rateConfig, ulbCodes])

  const totals = useMemo(() => {
    const propertyCount = rows.length
    const totalAnnualDemand = rows.reduce((sum, row) => sum + row.annualDemand, 0)
    const avgDemand = propertyCount > 0 ? totalAnnualDemand / propertyCount : 0
    return { propertyCount, totalAnnualDemand, avgDemand }
  }, [rows])

  return {
    filters,
    setFilters,
    rows,
    totals,
    masters,
    pageSize,
    setPageSize,
    pageNumber: paginated.pageNumber,
    canGoPrev: paginated.canGoPrev,
    canGoNext: paginated.canGoNext,
    goPrev: paginated.goPrev,
    goNext: paginated.goNext,
    isLoading: paginated.isLoading || groupedFloors === undefined,
    totalCount: paginated.totalCount ?? rows.length,
    requiresMunicipality: !filters.municipalityId,
    ratesLoading,
    selectedMunicipalityId,
    reportDateLabel,
    reportDateMs,
  }
}
