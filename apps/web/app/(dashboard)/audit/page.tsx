"use client"

import { filterAuditRows } from "@/components/audit/audit-helpers"
import {
  AuditFeedSection,
  AuditFiltersSection,
  AuditHero,
  AuditMetricsSection,
} from "@/components/audit/audit-page-sections"
import { PageTransition } from "@/components/design-system/motion"
import { RoleGate } from "@/components/shared/role-gate"
import { useAuditFacets, useAuditLogPaginated, useAuditSummary } from "@/hooks/audit/useAudit"
import { useMemo, useState } from "react"

export default function AuditPage() {
  const [action, setAction] = useState<string | undefined>()
  const [entity, setEntity] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState(15)

  const facets = useAuditFacets()
  const summary = useAuditSummary()

  const { rows, isLoading, pageNumber, canGoPrev, canGoNext, goNext, goPrev } = useAuditLogPaginated(
    { action, entity },
    pageSize
  )

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
      <PageTransition className="space-y-6 lg:space-y-8">
        <AuditHero />
        <AuditMetricsSection
          totalLabel={totalLabel}
          actionTypes={summary?.actions ?? "—"}
          entityTypes={summary?.entities ?? "—"}
          todayCount={summary?.today ?? "—"}
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
        />
        <AuditFeedSection
          rows={filtered}
          isLoading={isLoading}
          pageNumber={pageNumber}
          pageSize={pageSize}
          filteredCount={filtered?.length ?? 0}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrev}
          onNext={goNext}
          onPageSizeChange={setPageSize}
        />
      </PageTransition>
    </RoleGate>
  )
}
