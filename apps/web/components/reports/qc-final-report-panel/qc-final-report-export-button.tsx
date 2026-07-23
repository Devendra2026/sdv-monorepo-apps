"use client"

import type { FilterState } from "@/components/surveys/survey-filters"
import { useMasters } from "@/hooks/masters/useMasters"
import { parseConvexError } from "@/lib/errors"
import type { TaxRateConfig } from "@/lib/qc/demand-notice"
import {
  buildQcFinalReportExcelFilename,
  bundlesToQcFinalReportRows,
  exportQcFinalReportExcel,
  QC_FINAL_EXPORT_SCOPE_LIMIT,
} from "@/lib/reports/qc-final-report-excel"
import { buildUlbCodeMap } from "@/lib/survey/resolve-display-property-id"
import type { SurveyExportBundle } from "@/lib/survey/survey-excel"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { Button } from "@workspace/ui/components/button"
import { useConvex } from "convex/react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

/** Pause between pages so exports do not starve live dashboard queries. */
const EXPORT_PAGE_DELAY_MS = 200
const EXPORT_ID_PAGE_SIZE = 100

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchExportBundlesWithRetry(convex: ReturnType<typeof useConvex>, surveyIds: Id<"surveys">[]) {
  try {
    return await convex.query(api.export.queries.getExportBundlesByIds, { surveyIds })
  } catch (firstError) {
    await sleep(EXPORT_PAGE_DELAY_MS)
    try {
      return await convex.query(api.export.queries.getExportBundlesByIds, { surveyIds })
    } catch {
      throw firstError
    }
  }
}

async function collectAllExportIds(
  convex: ReturnType<typeof useConvex>,
  queryArgs: {
    qcStatus: "approved"
    wardNo?: string
    districtId?: Id<"districts">
    municipalityId?: Id<"municipalities">
  },
  onProgress: (loaded: number, total: number) => void
): Promise<{ surveyIds: Id<"surveys">[]; total: number; truncated: boolean }> {
  if (queryArgs.wardNo && !queryArgs.municipalityId) {
    throw new Error("Select a ULB before exporting a ward so all property IDs can be included.")
  }

  const surveyIds: Id<"surveys">[] = []
  let cursor: string | null = null
  let total = 0
  let truncated = false
  let guard = 0
  const maxPages = 2000

  for (;;) {
    guard += 1
    if (guard > maxPages) {
      throw new Error("Export ID paging exceeded safety limit — narrow filters and retry")
    }
    const page: {
      surveyIds: Id<"surveys">[]
      total: number
      truncated: boolean
      isDone: boolean
      continueCursor: string | null
    } = await convex.query(api.export.queries.listExportIds, {
      ...queryArgs,
      paginationOpts: { numItems: EXPORT_ID_PAGE_SIZE, cursor },
    })
    surveyIds.push(...page.surveyIds)
    total = Math.max(page.total, surveyIds.length)
    truncated = truncated || page.truncated
    onProgress(surveyIds.length, total)
    if (page.isDone) break
    if (page.continueCursor === null) break
    cursor = page.continueCursor
    await sleep(EXPORT_PAGE_DELAY_MS)
  }

  return { surveyIds, total: surveyIds.length, truncated }
}

type QcFinalReportExportButtonProps = {
  filters: FilterState
  disabled?: boolean
}

export function QcFinalReportExportButton({ filters, disabled }: QcFinalReportExportButtonProps) {
  const convex = useConvex()
  const { masters } = useMasters()
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs])
  const [exporting, setExporting] = useState(false)

  async function loadRateConfigs(municipalityIds: string[]): Promise<Map<string, TaxRateConfig | null>> {
    const map = new Map<string, TaxRateConfig | null>()
    const unique = [...new Set(municipalityIds)]
    await Promise.all(
      unique.map(async (municipalityId) => {
        const rates = await convex.query(api.taxation.queries.getForMunicipality, {
          municipalityId: municipalityId as Id<"municipalities">,
        })
        map.set(municipalityId, rates)
      })
    )
    return map
  }

  async function onExport() {
    setExporting(true)
    const progress = toast.loading("Preparing QC Final Report export…")
    try {
      const queryArgs = {
        qcStatus: "approved" as const,
        wardNo: filters.wardNo,
        districtId: filters.districtId as Id<"districts"> | undefined,
        municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
      }

      const { surveyIds, total, truncated } = await collectAllExportIds(convex, queryArgs, (loaded, expected) => {
        toast.loading(`Collecting IDs ${loaded.toLocaleString()} / ${expected.toLocaleString()}…`, {
          id: progress,
        })
      })
      if (!surveyIds.length) {
        toast.message("No QC-approved surveys to export for the current filters.", { id: progress })
        return
      }

      const allBundles: SurveyExportBundle[] = []
      const pageSize = 40
      for (let i = 0; i < surveyIds.length; i += pageSize) {
        const chunk = surveyIds.slice(i, i + pageSize)
        const page = await fetchExportBundlesWithRetry(convex, chunk)
        allBundles.push(...(page.bundles as SurveyExportBundle[]))
        toast.loading(`Loading ${allBundles.length.toLocaleString()} / ${total.toLocaleString()}…`, {
          id: progress,
        })
        if (i + pageSize < surveyIds.length) {
          await sleep(EXPORT_PAGE_DELAY_MS)
        }
      }

      const municipalityIds = allBundles.map((b) => b.municipalityId)
      const rateConfigByMunicipality = await loadRateConfigs(municipalityIds)

      const rows = bundlesToQcFinalReportRows(allBundles, ulbCodes, rateConfigByMunicipality, masters ?? undefined)

      const municipalityLabel = filters.municipalityId
        ? masters?.ulbs?.find((u) => u._id === filters.municipalityId)?.name
        : undefined

      const filename = buildQcFinalReportExcelFilename({
        municipalityLabel,
        wardNo: filters.wardNo,
      })

      exportQcFinalReportExcel(rows, filename)
      toast.success(`Exported ${rows.length.toLocaleString()} QC-approved survey(s) to Excel`, { id: progress })
      if (truncated || rows.length >= QC_FINAL_EXPORT_SCOPE_LIMIT) {
        toast.warning(`Export may be incomplete for this wide scope. Select a ULB or ward for a full download.`)
      }
    } catch (e) {
      toast.error(parseConvexError(e).message, { id: progress })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="cursor-pointer"
      disabled={disabled || exporting}
      onClick={() => void onExport()}
    >
      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {exporting ? "Exporting…" : "Export Excel"}
    </Button>
  )
}
