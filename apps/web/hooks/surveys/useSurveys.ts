"use client"
/**
 * Survey feature hooks — thin bindings over `api.surveys.queries.*` / `api.surveys.mutations.*`.
 * No business logic lives here; filtering/search beyond what the server
 * supports is applied client-side over the already tenant-scoped result.
 */
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady, useConvexAuthState } from "@/hooks/use-convex-auth-ready"
import { useCursorPagination } from "@/hooks/use-cursor-pagination"
import type { QcStatus, SurveyStatus } from "@/lib/domain"
import { formatRegistryParcelNo, formatRegistryWardNo } from "@/lib/survey/format-registry-parcel"
import { resolveDisplayPropertyId, type PropertyIdSource } from "@/lib/survey/resolve-display-property-id"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useQuery as useConvexQuery, useMutation, usePreloadedQuery, type Preloaded } from "convex/react"
import type { FunctionArgs } from "convex/server"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

let saveDraftQueue: Promise<unknown> = Promise.resolve()

function isSaveDraftOccError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("changed while this mutation") || msg.includes("Documents read from or written")
}

async function runSaveDraftWithRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run()
    } catch (err) {
      lastError = err
      if (!isSaveDraftOccError(err) || attempt === 2) throw err
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
  throw lastError
}

export interface SurveyListFilters {
  status?: SurveyStatus
  qcStatus?: QcStatus
  qcStatuses?: QcStatus[]
  wardNo?: string
  districtId?: string
  municipalityId?: string
  surveyorId?: string
  fromMs?: number
  toMs?: number
  parcelSharedOnly?: boolean
  limit?: number
  searchTerm?: string
}

/** api.surveys.queries.list — server enforces tenant scope + role visibility. */
export function useSurveyList(filters: SurveyListFilters = {}, enabled = true) {
  const ready = useConvexAuthReady()
  return useConvexQuery(
    api.surveys.queries.list,
    ready && enabled
      ? {
          status: filters.status,
          qcStatus: filters.qcStatus,
          qcStatuses: filters.qcStatuses,
          wardNo: filters.wardNo,
          districtId: filters.districtId as Id<"districts"> | undefined,
          municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
          surveyorId: filters.surveyorId as Id<"users"> | undefined,
          limit: filters.limit ?? 200,
        }
      : "skip"
  )
}

/** Cursor-paginated survey list sorted by ward then parcel ascending. */
export function useSurveyListPaginated(
  filters: SurveyListFilters = {},
  pageSize = 20,
  enabled = true,
  seedNowMs?: number
) {
  const nowMs = useClientNowMs(seedNowMs)
  const searchKey = filters.searchTerm?.trim() ?? ""
  const resetKey = `${filters.status ?? ""}|${filters.qcStatus ?? ""}|${(filters.qcStatuses ?? []).join(",")}|${filters.wardNo ?? ""}|${filters.districtId ?? ""}|${filters.municipalityId ?? ""}|${filters.surveyorId ?? ""}|${filters.fromMs ?? ""}|${filters.toMs ?? ""}|${filters.parcelSharedOnly ? "1" : "0"}|${searchKey}`
  const {
    cursor,
    pageIndex,
    pageSize: size,
    canGoPrev,
    goNext,
    goPrev,
    pageNumber,
  } = useCursorPagination(resetKey, pageSize)

  const ready = useConvexAuthReady()
  const { authLoading, isAuthenticated } = useConvexAuthState()
  const result = useConvexQuery(
    api.surveys.queries.listPaginated,
    ready && enabled && Number.isFinite(nowMs)
      ? {
          paginationOpts: { numItems: size, cursor },
          status: filters.status,
          qcStatus: filters.qcStatus,
          qcStatuses: filters.qcStatuses,
          wardNo: filters.wardNo,
          districtId: filters.districtId as Id<"districts"> | undefined,
          municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
          surveyorId: filters.surveyorId as Id<"users"> | undefined,
          fromMs: filters.fromMs,
          toMs: filters.toMs,
          parcelSharedOnly: filters.parcelSharedOnly,
          searchTerm: searchKey || undefined,
          nowMs,
        }
      : "skip"
  )

  const surveys = result?.page
  const totalCount = result?.totalCount
  const scopeTruncated = result?.scopeTruncated ?? false
  const canGoNext = result ? !result.isDone : false
  const queryEnabled = ready && enabled && Number.isFinite(nowMs)
  // Auth still resolving or query in flight — not "empty" and not perpetual skip-as-loading.
  const isLoading = queryEnabled ? result === undefined : authLoading

  return useMemo(
    () => ({
      surveys,
      totalCount,
      scopeTruncated,
      isLoading,
      /** Auth finished but user is not signed in — show sign-in, not a spinner. */
      authFailed: !authLoading && !isAuthenticated,
      pageNumber,
      pageIndex,
      pageSize: size,
      canGoPrev,
      canGoNext,
      goNext: () => {
        if (result) goNext(result.continueCursor, result.isDone)
      },
      goPrev,
    }),
    [
      surveys,
      totalCount,
      scopeTruncated,
      isLoading,
      authLoading,
      isAuthenticated,
      result,
      pageNumber,
      pageIndex,
      size,
      canGoPrev,
      canGoNext,
      goNext,
      goPrev,
    ]
  )
}

/** api.surveys.queries.get — full detail w/ floors, photos (hydrated URLs), qcRemarks. */
export function useSurvey(id: string | undefined) {
  const ready = useConvexAuthReady()
  return useConvexQuery(api.surveys.queries.get, ready && id ? { id: id as Id<"surveys"> } : "skip")
}

/** Hydrate a server-preloaded survey detail query. */
export function usePreloadedSurvey(preloaded: Preloaded<typeof api.surveys.queries.get>) {
  return usePreloadedQuery(preloaded)
}

export function useSubmitSurvey() {
  return useMutation(api.surveys.mutations.submit).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.surveys.queries.get, { id: args.id })
    if (!current) return
    localStore.setQuery(
      api.surveys.queries.get,
      { id: args.id },
      {
        ...current,
        status: "submitted",
      }
    )
  })
}
export function useRemoveSurvey() {
  return useMutation(api.surveys.mutations.remove)
}
function useUpsertSurvey() {
  return useMutation(api.surveys.mutations.upsert)
}
export function useSaveDraft() {
  const mutate = useMutation(api.surveys.mutations.saveDraft).withOptimisticUpdate((localStore, args) => {
    if (!args.id) return
    const current = localStore.getQuery(api.surveys.queries.get, { id: args.id })
    if (!current) return
    const { id, localId: _localId, municipalityId: _municipalityId, clientUpdatedAt, ...patch } = args
    localStore.setQuery(
      api.surveys.queries.get,
      { id: args.id },
      {
        ...current,
        ...patch,
        clientUpdatedAt,
      }
    )
  })

  return useCallback(
    (args: FunctionArgs<typeof api.surveys.mutations.saveDraft>) => {
      const run = () =>
        runSaveDraftWithRetry(() => mutate(args)).catch((error) => {
          toast.error(error instanceof Error ? error.message : "Failed to save draft")
          throw error
        })
      const result = saveDraftQueue.then(run, run)
      saveDraftQueue = result.catch(() => undefined)
      return result
    },
    [mutate]
  )
}
export function useSetGps() {
  return useMutation(api.surveys.mutations.setGps).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.surveys.queries.get, { id: args.id })
    if (!current) return
    localStore.setQuery(
      api.surveys.queries.get,
      { id: args.id },
      {
        ...current,
        gps: args.gps,
      }
    )
  })
}

/** QC registry search — property ID, owner name, parcel number, and ward number. */
export function searchQcRegistry<
  T extends PropertyIdSource & {
    respondentName?: string
    parcelNo?: string
    wardNo?: string
    owners?: { name?: string }[]
  },
>(rows: T[], term: string, ulbCodes?: Map<string, string>): T[] {
  const q = term.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => {
    const displayId = resolveDisplayPropertyId(r, ulbCodes)
    const wardVariants = [
      r.wardNo,
      formatRegistryWardNo(r.wardNo),
      r.wardNo ? `ward ${r.wardNo}` : undefined,
      r.wardNo ? `w${r.wardNo}` : undefined,
    ]
    return [
      displayId,
      r.propertyId,
      r.respondentName,
      r.parcelNo,
      formatRegistryParcelNo(r.parcelNo),
      ...wardVariants,
      ...(r.owners?.map((o) => o.name) ?? []),
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })
}
