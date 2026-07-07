"use client";

import { QcDataTable, type QcDataTableRow } from "@/components/qc/qc-data-table";
import { SurveyRegistrySearch } from "@/components/surveys/survey-registry-search";
import { useMasters } from "@/hooks/masters/useMasters";
import type { ParcelSiblingIndex } from "@/lib/qc/parcel-siblings";
import { buildUlbCodeMap } from "@/lib/survey/resolve-display-property-id";
import { useMemo } from "react";

/** QC portal wrapper — amber border styling for registry search. */
export function QcRegistrySearchBar(props: { value: string; onChange: (term: string) => void }) {
  return (
    <SurveyRegistrySearch
      {...props}
      placeholder="Search property ID, owner, parcel, or ward…"
      inputClassName="h-10 rounded-lg border-amber-300/40 bg-background pl-9 dark:border-amber-700/40"
    />
  );
}

export type QcRegistryRow = QcDataTableRow;

export function QcRegistryTable({
  rows,
  pageStart = 0,
  hrefBase = "/qc",
  siblingIndex,
}: {
  rows?: QcRegistryRow[];
  pageStart?: number;
  hrefBase?: string;
  siblingIndex?: ParcelSiblingIndex;
}) {
  const { masters } = useMasters();
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs]);
  const propertyUses = masters?.propertyUses;

  return (
    <QcDataTable
      rows={rows}
      pageStart={pageStart}
      hrefBase={hrefBase}
      siblingIndex={siblingIndex}
      propertyUses={propertyUses}
      ulbCodes={ulbCodes}
      showSurveyor
    />
  );
}
