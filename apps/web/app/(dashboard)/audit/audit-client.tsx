"use client"

import { filterAuditRows } from "@/components/audit/audit-helpers"
import {
  AuditFeedSection,
  AuditFiltersSection,
  AuditHero,
  AuditMetricsSection,
} from "@/components/audit/audit-page-sections"
import { RoleGate } from "@/components/shared/role-gate"
import { useAuditFacets, useAuditLogPaginated, useAuditSummary } from "@/hooks/audit/useAudit"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { usePreloadedQuery, type Preloaded } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useMemo, useState } from "react"

type AuditSummary = FunctionReturnType<typeof api.audit.queries.summary>

type AuditClientProps = {
  preloadedRows: Preloaded<typeof api.audit.queries.listPaginated>
  preloadedSummary: Preloaded<typeof api.audit.queries.summary>
  preloadedFacets: Preloaded<typeof api.audit.queries.actionFacets>
  nowMs: number
}

export function AuditClient({ preloadedRows, preloadedSummary, preloadedFacets, nowMs }: AuditClientProps) {
  const seedRowsPage = usePreloadedQuery(preloadedRows)
  const seedSummary = usePreloadedQuery(preloadedSummary)
  const seedFacets = usePreloadedQuery(preloadedFacets)

  const [action, setAction] = useState<string | undefined>()
  const [entity, setEntity] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState(15)

  const liveSummary = useAuditSummary(nowMs)
  const liveFacets = useAuditFacets()
  const summary: AuditSummary | undefined = liveSummary ?? seedSummary
  const facets = liveFacets ?? seedFacets

  const {
    rows: liveRows,
    isLoading,
    pageNumber,
    canGoPrev,
    canGoNext,
    goNext,
    goPrev,
  } = useAuditLogPaginated({ action, entity }, pageSize)

  const rows =
    liveRows ?? (action === undefined && entity === undefined && pageNumber === 1 ? seedRowsPage?.page : undefined)

  const filtered = useMemo(() => {
    if (!rows) return undefined
    return filterAuditRows(rows, search)
  }, [rows, search])

  const hasFilters = action !== undefined || entity !== undefined || search.trim().length > 0

  function clearFilters() {
    setAction(undefined)
    setEntity(undefined)
    setSearch("")
  }

  const totalLabel = summary ? (summary.capped ? "1000+" : String(summary.total)) : "—"

  return (
    <RoleGate mode="page" capability="audit.view" deniedDescription="The audit log is restricted to administrators.">
      <div className="space-y-6 lg:space-y-8">
        <AuditHero />
        <AuditMetricsSection
          totalLabel={totalLabel}
          actionTypes={summary?.actions ?? "—"}
          entityTypes={summary?.entities ?? "—"}
          todayCount={summary?.today ?? "—"}
          loaded={summary !== undefined}
        />
        <AuditFiltersSection
          search={search}
          onSearchChange={setSearch}
          action={action}
          onActionChange={setAction}
          entity={entity}
          onEntityChange={setEntity}
          actionOptions={facets?.actions}
          entityOptions={facets?.entities}
          hasFilters={hasFilters}
          onClear={clearFilters}
          loaded={facets !== undefined}
        />
        <AuditFeedSection
          rows={filtered}
          isLoading={isLoading && rows === undefined}
          pageNumber={pageNumber}
          pageSize={pageSize}
          filteredCount={filtered?.length ?? 0}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrev}
          onNext={goNext}
          onPageSizeChange={setPageSize}
        />
      </div>
    </RoleGate>
  )
}
