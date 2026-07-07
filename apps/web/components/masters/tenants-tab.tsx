"use client";

import { TenantDialogs } from "@/components/masters/tenant-dialogs";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { TablePagination } from "@/components/shared/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { Id } from "@/convex/_generated/dataModel";
import { useTenantAdmin, useUpsertDistrict, useUpsertMunicipality, useUpsertWard } from "@/hooks/tenants/useTenants";
import { parseConvexError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Building2, ChevronDown, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useReducer, useState, type Dispatch } from "react";
import { toast } from "sonner";
import type {
  DistrictDraft,
  MunicipalityDraft,
  TenantDistrict,
  TenantUlb,
  TenantWard,
  WardDraft,
} from "./tenant-types";

const DEFAULT_DISTRICT_PAGE_SIZE = 10;
const DEFAULT_ULB_PAGE_SIZE = 10;
const DEFAULT_WARD_PAGE_SIZE = 24;

function matchesTenantSearch(district: TenantDistrict, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (district.name.toLowerCase().includes(q) || district.code.toLowerCase().includes(q)) return true;
  if (district.stateName.toLowerCase().includes(q)) return true;
  return district.ulbs.some(
    (ulb) =>
      ulb.name.toLowerCase().includes(q) ||
      ulb.code.toLowerCase().includes(q) ||
      ulb.wards.some((w) => w.name.toLowerCase().includes(q) || String(w.wardNo).includes(q)),
  );
}

function CompactPagination({
  page,
  pageSize,
  total,
  onPageChange,
  noun,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  noun: string;
  className?: string;
}) {
  if (total <= pageSize) return null;

  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={cn("flex items-center justify-between gap-2 pt-1", className)}>
      <p className="text-[10px] text-muted-foreground">
        {start}–{end} of {total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-6 w-6"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label={`Previous ${noun} page`}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <span className="min-w-8 text-center text-[10px] font-medium tabular-nums text-muted-foreground">
          {page}/{totalPages}
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-6 w-6"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label={`Next ${noun} page`}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── UI state (drafts + expand/collapse) ─────────────────────────────────────

type TenantsUiState = {
  districtDraft: DistrictDraft | null;
  muniDraft: MunicipalityDraft | null;
  wardDraft: WardDraft | null;
  expandedDistricts: Set<string>;
  expandedUlbs: Set<string>;
};

type TenantsUiAction =
  | { type: "setDistrictDraft"; draft: DistrictDraft | null }
  | { type: "setMuniDraft"; draft: MunicipalityDraft | null }
  | { type: "setWardDraft"; draft: WardDraft | null }
  | { type: "setDistrictOpen"; id: string; open: boolean }
  | { type: "setUlbOpen"; id: string; open: boolean };

const initialTenantsUiState: TenantsUiState = {
  districtDraft: null,
  muniDraft: null,
  wardDraft: null,
  expandedDistricts: new Set(),
  expandedUlbs: new Set(),
};

function tenantsUiReducer(state: TenantsUiState, action: TenantsUiAction): TenantsUiState {
  switch (action.type) {
    case "setDistrictDraft":
      return { ...state, districtDraft: action.draft };
    case "setMuniDraft":
      return { ...state, muniDraft: action.draft };
    case "setWardDraft":
      return { ...state, wardDraft: action.draft };
    case "setDistrictOpen": {
      const expandedDistricts = new Set(state.expandedDistricts);
      if (action.open) expandedDistricts.add(action.id);
      else expandedDistricts.delete(action.id);
      return { ...state, expandedDistricts };
    }
    case "setUlbOpen": {
      const expandedUlbs = new Set(state.expandedUlbs);
      if (action.open) expandedUlbs.add(action.id);
      else expandedUlbs.delete(action.id);
      return { ...state, expandedUlbs };
    }
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function TenantsSummaryBar({ tenants, onAddDistrict }: { tenants: TenantDistrict[]; onAddDistrict: () => void }) {
  const ulbCount = tenants.reduce((acc, d) => acc + d.ulbs.length, 0);
  const wardCount = tenants.reduce((acc, d) => acc + d.ulbs.reduce((a, u) => a + u.wards.length, 0), 0);

  return (
    <div className="flex flex-col gap-4 border-b border-border/60 bg-linear-to-r from-violet-50/80 to-card px-5 py-4 dark:from-violet-950/30 dark:to-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
          <MapPin className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight">Geographic Hierarchy</h2>
          <p className="text-xs text-muted-foreground">
            Districts, ULBs, and wards for supervisor and surveyor assignment
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px] font-semibold">
              {tenants.length} district{tenants.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {ulbCount} ULB{ulbCount !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {wardCount} ward{wardCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>
      <Button size="sm" className="h-9 shrink-0 shadow-sm" onClick={onAddDistrict}>
        <Plus className="h-4 w-4" /> Add district
      </Button>
    </div>
  );
}

function WardChips({
  wards,
  municipalityId,
  onEditWard,
}: {
  wards: TenantWard[];
  municipalityId: Id<"municipalities">;
  onEditWard: (draft: WardDraft) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_WARD_PAGE_SIZE;

  if (wards.length === 0) {
    return <p className="text-xs text-muted-foreground">No wards yet.</p>;
  }

  const pagedWards = wards.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {pagedWards.map((ward) => (
          <button
            key={ward._id}
            type="button"
            className="group flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs shadow-sm transition-all hover:border-violet-400/50 hover:bg-violet-500/5 hover:shadow"
            onClick={() =>
              onEditWard({
                id: ward._id as Id<"wards">,
                municipalityId,
                wardNo: ward.wardNo,
                wardCode: ward.wardCode ?? "",
                name: ward.name,
              })
            }
          >
            <span className="font-medium">W{ward.wardNo}</span>
            <span className="text-muted-foreground">· {ward.name}</span>
            <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
      <CompactPagination page={page} pageSize={pageSize} total={wards.length} onPageChange={setPage} noun="wards" />
    </div>
  );
}

function UlbRow({
  ulb,
  districtId,
  isOpen,
  onOpenChange,
  onEditUlb,
  onAddWard,
  onEditWard,
}: {
  ulb: TenantUlb;
  districtId: Id<"districts">;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEditUlb: (draft: MunicipalityDraft) => void;
  onAddWard: () => void;
  onEditWard: (draft: WardDraft) => void;
}) {
  return (
    <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{ulb.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{ulb.code}</span>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {ulb.bodyType === "municipal_council" ? "MC" : "TP"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {ulb.wards.length} ward{ulb.wards.length !== 1 ? "s" : ""}
            </Badge>
            {!ulb.isActive && (
              <Badge variant="secondary" className="text-[10px]">
                Inactive
              </Badge>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() =>
                onEditUlb({
                  id: ulb._id as Id<"municipalities">,
                  districtId,
                  code: ulb.code,
                  name: ulb.name,
                  bodyType: ulb.bodyType as MunicipalityDraft["bodyType"],
                  postalCode: ulb.postalCode ?? "",
                  isActive: ulb.isActive,
                })
              }
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border bg-background px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Wards</p>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={onAddWard}>
                <Plus className="h-3 w-3" /> Add ward
              </Button>
            </div>
            <WardChips
              key={`${ulb._id}:${ulb.wards.length}`}
              wards={ulb.wards}
              municipalityId={ulb._id as Id<"municipalities">}
              onEditWard={onEditWard}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function DistrictRow({
  district,
  isOpen,
  expandedUlbs,
  onDistrictOpenChange,
  onUlbOpenChange,
  onEditDistrict,
  onAddUlb,
  onEditUlb,
  onAddWard,
  onEditWard,
}: {
  district: TenantDistrict;
  isOpen: boolean;
  expandedUlbs: Set<string>;
  onDistrictOpenChange: (open: boolean) => void;
  onUlbOpenChange: (id: string, open: boolean) => void;
  onEditDistrict: () => void;
  onAddUlb: () => void;
  onEditUlb: (draft: MunicipalityDraft) => void;
  onAddWard: (ulb: TenantUlb) => void;
  onEditWard: (draft: WardDraft) => void;
}) {
  const districtId = district._id as Id<"districts">;
  const [ulbPage, setUlbPage] = useState(1);
  const ulbPageSize = DEFAULT_ULB_PAGE_SIZE;

  const pagedUlbs = district.ulbs.slice((ulbPage - 1) * ulbPageSize, ulbPage * ulbPageSize);

  return (
    <Card className="overflow-hidden border-l-4 border-l-violet-500/60 shadow-sm transition-shadow hover:shadow-md">
      <Collapsible open={isOpen} onOpenChange={onDistrictOpenChange}>
        <div className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-sm">{district.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{district.code}</span>
                <span className="ml-2 text-xs text-muted-foreground">{district.stateName}</span>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {district.ulbs.length} ULB{district.ulbs.length !== 1 ? "s" : ""}
            </Badge>
            {!district.isActive && (
              <Badge variant="secondary" className="text-xs">
                Inactive
              </Badge>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEditDistrict}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ULBs / Municipalities
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddUlb}>
                <Plus className="h-3.5 w-3.5" /> Add ULB
              </Button>
            </div>

            {district.ulbs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No ULBs yet for this district.</p>
            ) : (
              <div className="space-y-1.5">
                {pagedUlbs.map((ulb) => (
                  <UlbRow
                    key={ulb._id}
                    ulb={ulb}
                    districtId={districtId}
                    isOpen={expandedUlbs.has(ulb._id)}
                    onOpenChange={(open) => onUlbOpenChange(ulb._id, open)}
                    onEditUlb={onEditUlb}
                    onAddWard={() => onAddWard(ulb)}
                    onEditWard={onEditWard}
                  />
                ))}
                <CompactPagination
                  page={ulbPage}
                  pageSize={ulbPageSize}
                  total={district.ulbs.length}
                  onPageChange={setUlbPage}
                  noun="ULBs"
                  className="px-1"
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function DistrictList({
  tenants,
  expandedDistricts,
  expandedUlbs,
  dispatch,
}: {
  tenants: TenantDistrict[];
  expandedDistricts: Set<string>;
  expandedUlbs: Set<string>;
  dispatch: Dispatch<TenantsUiAction>;
}) {
  return (
    <div className="space-y-2">
      {tenants.map((district) => (
        <DistrictRow
          key={`${district._id}:${district.ulbs.length}`}
          district={district}
          isOpen={expandedDistricts.has(district._id)}
          expandedUlbs={expandedUlbs}
          onDistrictOpenChange={(open) => dispatch({ type: "setDistrictOpen", id: district._id, open })}
          onUlbOpenChange={(id, open) => dispatch({ type: "setUlbOpen", id, open })}
          onEditDistrict={() =>
            dispatch({
              type: "setDistrictDraft",
              draft: {
                id: district._id as Id<"districts">,
                code: district.code,
                name: district.name,
                stateName: district.stateName,
                isActive: district.isActive,
              },
            })
          }
          onAddUlb={() =>
            dispatch({
              type: "setMuniDraft",
              draft: {
                districtId: district._id as Id<"districts">,
                code: "",
                name: "",
                bodyType: "municipal_council",
                postalCode: "",
                isActive: true,
              },
            })
          }
          onEditUlb={(draft) => dispatch({ type: "setMuniDraft", draft })}
          onAddWard={(ulb) =>
            dispatch({
              type: "setWardDraft",
              draft: {
                municipalityId: ulb._id as Id<"municipalities">,
                wardNo: String(ulb.wards.length + 1),
                wardCode: "",
                name: "",
              },
            })
          }
          onEditWard={(draft) => dispatch({ type: "setWardDraft", draft })}
        />
      ))}
    </div>
  );
}

// ─── main tab ────────────────────────────────────────────────────────────────

export function TenantsTab() {
  const tenants = useTenantAdmin();
  const upsertDistrict = useUpsertDistrict();
  const upsertMunicipality = useUpsertMunicipality();
  const upsertWard = useUpsertWard();
  const [ui, dispatch] = useReducer(tenantsUiReducer, initialTenantsUiState);
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_DISTRICT_PAGE_SIZE);

  const filteredDistricts = useMemo(() => {
    if (!tenants) return [];
    return (tenants as TenantDistrict[]).filter((d) => matchesTenantSearch(d, search));
  }, [tenants, search]);

  const totalDistrictPages = Math.max(1, Math.ceil(filteredDistricts.length / pageSize));
  const effectivePageNumber = Math.min(Math.max(1, pageNumber), totalDistrictPages);

  const pagedDistricts = useMemo(() => {
    const start = (effectivePageNumber - 1) * pageSize;
    return filteredDistricts.slice(start, start + pageSize);
  }, [filteredDistricts, effectivePageNumber, pageSize]);

  const canGoPrev = effectivePageNumber > 1;
  const canGoNext = effectivePageNumber < totalDistrictPages;

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPageNumber(1);
  }

  async function saveDistrict(d: DistrictDraft) {
    try {
      await upsertDistrict({
        id: d.id,
        code: d.code,
        name: d.name,
        stateName: d.stateName,
        isActive: d.isActive,
      });
      toast.success(d.id ? "District updated" : "District created");
      dispatch({ type: "setDistrictDraft", draft: null });
    } catch (e) {
      toast.error(parseConvexError(e).message);
      throw e;
    }
  }

  async function saveMunicipality(m: MunicipalityDraft) {
    try {
      await upsertMunicipality({
        id: m.id,
        districtId: m.districtId,
        code: m.code,
        name: m.name,
        bodyType: m.bodyType,
        postalCode: m.postalCode || undefined,
        isActive: m.isActive,
      });
      toast.success(m.id ? "ULB updated" : "ULB created");
      dispatch({ type: "setMuniDraft", draft: null });
    } catch (e) {
      toast.error(parseConvexError(e).message);
      throw e;
    }
  }

  async function saveWard(w: WardDraft) {
    try {
      await upsertWard({
        id: w.id,
        municipalityId: w.municipalityId,
        wardNo: w.wardNo,
        wardCode: w.wardCode || undefined,
        name: w.name,
      });
      toast.success(w.id ? "Ward updated" : "Ward created");
      dispatch({ type: "setWardDraft", draft: null });
    } catch (e) {
      toast.error(parseConvexError(e).message);
      throw e;
    }
  }

  if (tenants === undefined) return <TableSkeleton rows={4} />;

  const tenantRows = tenants as TenantDistrict[];

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <TenantsSummaryBar
        tenants={tenantRows}
        onAddDistrict={() =>
          dispatch({
            type: "setDistrictDraft",
            draft: { code: "", name: "", stateName: "Uttar Pradesh", isActive: true },
          })
        }
      />

      <div className="p-5 space-y-4">
        {tenantRows.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search districts, ULBs, or wards…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageNumber(1);
                }}
                className="h-9 pl-8 text-sm"
              />
            </div>
            {search.trim() && (
              <p className="text-xs text-muted-foreground">
                {filteredDistricts.length} of {tenantRows.length} district{tenantRows.length !== 1 ? "s" : ""} match
              </p>
            )}
          </div>
        )}

        {tenantRows.length === 0 ? (
          <EmptyState
            title="No districts yet"
            description="Add a district to start building your tenant hierarchy."
            icon={MapPin}
            action={
              <Button
                size="sm"
                onClick={() =>
                  dispatch({
                    type: "setDistrictDraft",
                    draft: { code: "", name: "", stateName: "Uttar Pradesh", isActive: true },
                  })
                }
              >
                <Plus className="h-4 w-4" /> Add district
              </Button>
            }
          />
        ) : filteredDistricts.length === 0 ? (
          <EmptyState
            title="No matching districts"
            description="Try a different search term."
            icon={Search}
            action={
              <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <>
            <DistrictList
              tenants={pagedDistricts}
              expandedDistricts={ui.expandedDistricts}
              expandedUlbs={ui.expandedUlbs}
              dispatch={dispatch}
            />

            <TablePagination
              pageNumber={effectivePageNumber}
              pageSize={pageSize}
              itemCount={pagedDistricts.length}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrev={() => setPageNumber((p) => Math.max(1, p - 1))}
              onNext={() => setPageNumber((p) => Math.min(totalDistrictPages, p + 1))}
              pageSizeOptions={[5, 10, 20, 50]}
              onPageSizeChange={handlePageSizeChange}
              className="border-t-0 pt-0"
            />
          </>
        )}
      </div>

      <TenantDialogs
        districtDraft={ui.districtDraft}
        muniDraft={ui.muniDraft}
        wardDraft={ui.wardDraft}
        onCloseDistrict={() => dispatch({ type: "setDistrictDraft", draft: null })}
        onCloseMuni={() => dispatch({ type: "setMuniDraft", draft: null })}
        onCloseWard={() => dispatch({ type: "setWardDraft", draft: null })}
        onSaveDistrict={saveDistrict}
        onSaveMunicipality={saveMunicipality}
        onSaveWard={saveWard}
      />
    </Card>
  );
}
