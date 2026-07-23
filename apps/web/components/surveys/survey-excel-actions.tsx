"use client"

import type { QcStatus, SurveyStatus } from "@/lib/domain"
import { parseConvexError } from "@/lib/errors"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { Button } from "@workspace/ui/components/button"
import { useConvex, useMutation } from "convex/react"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

/** Must stay ≤ backend MAX_EXPORT_PAGE_SIZE (40). Smaller pages cut storage.getUrl fan-out. */
const EXPORT_BUNDLE_PAGE_SIZE = 20
/** ID pages from listExportIds — keep ≤ backend MAX_EXPORT_ID_PAGE_SIZE (200). */
const EXPORT_ID_PAGE_SIZE = 100
/** Pause between pages so exports do not starve live dashboard queries / SQLite. */
const EXPORT_PAGE_DELAY_MS = 500

/**
 * Photo storage URLs are included in Excel by default (Photos sheet "Photo URL").
 * Set NEXT_PUBLIC_EXPORT_PHOTO_URLS=0 to skip URL resolution (faster, metadata only).
 */
const EXPORT_INCLUDE_PHOTO_URLS =
  process.env.NEXT_PUBLIC_EXPORT_PHOTO_URLS !== "0" && process.env.NEXT_PUBLIC_EXPORT_PHOTO_URLS !== "false"

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchExportBundlesWithRetry(
  convex: ReturnType<typeof useConvex>,
  surveyIds: Id<"surveys">[],
  includePhotoUrls: boolean
) {
  try {
    return await convex.query(api.export.queries.getExportBundlesByIds, {
      surveyIds,
      includePhotoUrls,
    })
  } catch (firstError) {
    // One retry on transient isolate / timeout failures.
    await sleep(EXPORT_PAGE_DELAY_MS)
    try {
      return await convex.query(api.export.queries.getExportBundlesByIds, {
        surveyIds,
        includePhotoUrls,
      })
    } catch {
      throw firstError
    }
  }
}

async function collectAllExportIds(
  convex: ReturnType<typeof useConvex>,
  queryArgs: {
    status?: SurveyStatus
    qcStatus?: QcStatus
    wardNo?: string
    districtId?: Id<"districts">
    municipalityId?: Id<"municipalities">
    surveyorId?: Id<"users">
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
  /** 1500 ward rows @ 100/page ≈ 15 pages; allow large ULBs / photo-heavy retries. */
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
    // Prefer live collected count so a stale rollup total never stops the download short.
    total = Math.max(page.total, surveyIds.length)
    truncated = truncated || page.truncated
    onProgress(surveyIds.length, total)
    if (page.isDone) break
    if (page.continueCursor === null) {
      // Backend said not done but gave no cursor — treat as complete to avoid a hang.
      break
    }
    cursor = page.continueCursor
    await sleep(EXPORT_PAGE_DELAY_MS)
  }

  return { surveyIds, total: surveyIds.length, truncated }
}

export type SurveyExportFilters = {
  status?: SurveyStatus
  qcStatus?: QcStatus
  wardNo?: string
  districtId?: string
  municipalityId?: string
  surveyorId?: string
}

export function SurveyExcelActions({
  filters,
  canImport = false,
  disabled,
}: {
  filters: SurveyExportFilters
  canImport?: boolean
  disabled?: boolean
}) {
  const convex = useConvex()
  const importBundle = useMutation(api.export.mutations.importExcelBundle)
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  async function onExport() {
    setExporting(true)
    const progress = toast.loading("Preparing Excel export…")
    try {
      const queryArgs = {
        status: filters.status,
        qcStatus: filters.qcStatus,
        wardNo: filters.wardNo,
        districtId: filters.districtId as Id<"districts"> | undefined,
        municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
        surveyorId: filters.surveyorId as Id<"users"> | undefined,
      }

      const { surveyIds, total, truncated } = await collectAllExportIds(convex, queryArgs, (loaded, expected) => {
        toast.loading(`Collecting IDs ${loaded.toLocaleString()} / ${expected.toLocaleString()}…`, {
          id: progress,
        })
      })
      if (!surveyIds.length) {
        toast.message("No surveys to export for the current filters.", { id: progress })
        return
      }

      const { appendSurveyExportBundles, createSurveyExcelExportAccumulator, finalizeSurveyExcelExport } =
        await import("@/lib/survey/survey-excel")
      const acc = createSurveyExcelExportAccumulator()
      for (let i = 0; i < surveyIds.length; i += EXPORT_BUNDLE_PAGE_SIZE) {
        const chunk = surveyIds.slice(i, i + EXPORT_BUNDLE_PAGE_SIZE)
        const page = await fetchExportBundlesWithRetry(convex, chunk, EXPORT_INCLUDE_PHOTO_URLS)
        appendSurveyExportBundles(acc, page.bundles as Parameters<typeof appendSurveyExportBundles>[1])
        toast.loading(`Loading ${acc.surveys.length.toLocaleString()} / ${total.toLocaleString()}…`, {
          id: progress,
        })
        if (i + EXPORT_BUNDLE_PAGE_SIZE < surveyIds.length) {
          await sleep(EXPORT_PAGE_DELAY_MS)
        }
      }

      finalizeSurveyExcelExport(acc)
      toast.success(`Exported ${acc.surveys.length} survey(s) to Excel`, { id: progress })
      if (truncated) {
        toast.warning(
          `Export was capped at ${surveyIds.length.toLocaleString()} surveys for this wide scope. Select a ULB or ward for a full download.`
        )
      }
    } catch (e) {
      toast.error(parseConvexError(e).message, { id: progress })
    } finally {
      setExporting(false)
    }
  }

  async function onImportFile(file: File) {
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const { parseSurveyExcelFile } = await import("@/lib/survey/survey-excel")
      const payload = parseSurveyExcelFile(buffer)
      if (payload.surveys.length === 0) {
        toast.error("No valid survey rows found. Check the Surveys sheet and required columns.")
        return
      }
      const result = await importBundle({
        surveys: payload.surveys as any,
        floors: payload.floors as any,
      })
      const errCount = result.errors.length
      toast.success(
        `Import complete: ${result.created} created, ${result.updated} updated${errCount ? `, ${errCount} error(s)` : ""}.`
      )
      if (errCount > 0) {
        console.warn("Survey import errors", result.errors)
        toast.message("Some rows failed — see browser console for details.")
      }
    } catch (e) {
      toast.error(parseConvexError(e).message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={disabled || exporting} onClick={onExport}>
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        {exporting ? "Exporting…" : "Export Excel"}
      </Button>
      {canImport && (
        <>
          <input
            id="import-excel-file"
            aria-label="Import Excel file"
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
            }}
          />
          <Button
            id="import-excel-button"
            variant="outline"
            disabled={disabled || importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importing…" : "Import Excel"}
          </Button>
        </>
      )}
    </div>
  )
}
