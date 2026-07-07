"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import type { RateForm, WardInfo } from "@/components/masters/tax-rates-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { NormalizedTaxRates } from "@/lib/qc/normalize-tax-rates";
import { TAX_RATE_CONSTRUCTION_COLS, TAX_RATE_ZONE_ROWS } from "@/lib/qc/tax-rate-defaults";
import { hasWardCustomRates } from "@/lib/qc/tax-rate-matrix";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  MapPin,
  Percent,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings2,
} from "lucide-react";
import type { ComponentType } from "react";
import type { RateInputProps, WardRatePreviewProps } from "./ulb-rate-editor-widgets";

type UlbRateEditorHeaderProps = {
  municipalityName: string;
  districtName: string;
  wardCount: number;
  configuredCount: number;
  existing: NormalizedTaxRates | null;
  saving: boolean;
  saved: boolean;
  resetting: boolean;
  onResetAll: () => void;
  onSaveAll: () => void;
};

export function UlbRateEditorHeader({
  municipalityName,
  districtName,
  wardCount,
  configuredCount,
  existing,
  saving,
  saved,
  resetting,
  onResetAll,
  onSaveAll,
}: UlbRateEditorHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-premium-sm">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Minimum Monthly Rental Rates
        </p>
        <h3 className="font-display text-xl font-bold tracking-tight text-foreground">{municipalityName}</h3>
        <p className="text-sm text-muted-foreground">
          {districtName} · {wardCount} wards · {configuredCount} with published ward rates
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {existing ? (
          <Badge className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Published
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1.5">
            <Settings2 className="h-3 w-3" aria-hidden /> System Defaults
          </Badge>
        )}
        {existing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            disabled={resetting}
            className="cursor-pointer gap-1.5 text-muted-foreground hover:text-destructive"
          >
            {resetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
            )}
            Reset ULB
          </Button>
        )}
        <Button
          size="sm"
          onClick={onSaveAll}
          disabled={saving}
          className="cursor-pointer gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : saved ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden />
          )}
          {saved ? "Saved" : "Save All Wards"}
        </Button>
      </div>
    </div>
  );
}

type UlbRateEditorWardRailProps = {
  wardSearch: string;
  onWardSearchChange: (value: string) => void;
  filteredWards: WardInfo[];
  activeWardNo: string;
  onSelectWard: (wardNo: string) => void;
  existing: NormalizedTaxRates | null;
  dirtyWardNos: Set<string>;
};

export function UlbRateEditorWardRail({
  wardSearch,
  onWardSearchChange,
  filteredWards,
  activeWardNo,
  onSelectWard,
  existing,
  dirtyWardNos,
}: UlbRateEditorWardRailProps) {
  return (
    <GlassCard padding="none" className="overflow-hidden xl:max-h-[calc(100vh-14rem)]">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Wards</p>
        <div className="relative mt-2">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={wardSearch}
            onChange={(e) => onWardSearchChange(e.target.value)}
            placeholder="Search ward…"
            className="h-8 pl-8 text-xs"
            aria-label="Search wards"
          />
        </div>
      </div>
      <ScrollArea className="h-[min(420px,50vh)] xl:h-[calc(100vh-18rem)]">
        <ul className="p-2">
          {filteredWards.map((ward) => {
            const active = ward.wardNo === activeWardNo;
            const hasCustom = hasWardCustomRates(ward.wardNo, existing?.wardRates);
            const isDirty = dirtyWardNos.has(ward.wardNo);
            return (
              <li key={ward.wardNo}>
                <button
                  type="button"
                  onClick={() => onSelectWard(ward.wardNo)}
                  className={cn(
                    "mb-1 w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition-colors",
                    active ? "bg-emerald-600 text-white shadow-sm" : "hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "font-mono text-xs font-bold tabular-nums",
                        active ? "text-white/90" : "text-primary",
                      )}
                    >
                      Ward {ward.wardNo}
                    </span>
                    <span className="flex items-center gap-1">
                      {isDirty && (
                        <span
                          className={cn("h-2 w-2 rounded-full", active ? "bg-amber-200" : "bg-amber-500")}
                          title="Unsaved changes"
                        />
                      )}
                      {hasCustom && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                          )}
                        >
                          Saved
                        </span>
                      )}
                    </span>
                  </div>
                  <p
                    className={cn("mt-0.5 truncate text-xs font-medium", active ? "text-white/95" : "text-foreground")}
                  >
                    {ward.name}
                  </p>
                  <p className={cn("truncate text-[10px]", active ? "text-white/70" : "text-muted-foreground")}>
                    {ward.wardCode}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </GlassCard>
  );
}

type UlbRateEditorWardMatrixPanelProps = {
  selectedWard: WardInfo;
  wardMatrix: RateForm["wardMatrices"][string];
  form: RateForm;
  savingWard: boolean;
  wardSaved: boolean;
  selectedWardDirty: boolean;
  ulbSettingsDirty: boolean;
  previewZoneKey: string;
  previewConstrKey: string;
  onPreviewZoneChange: (key: string) => void;
  onPreviewConstrChange: (key: string) => void;
  onApplyDefault: () => void;
  onResetSystemDefault: () => void;
  onCopyToAll: () => void;
  onSaveWard: () => void;
  onCellChange: (zone: string, constr: string, val: string) => void;
  WardRatePreview: ComponentType<WardRatePreviewProps>;
  RateInput: ComponentType<RateInputProps>;
};

export function UlbRateEditorWardMatrixPanel({
  selectedWard,
  wardMatrix,
  form,
  savingWard,
  wardSaved,
  selectedWardDirty,
  ulbSettingsDirty,
  previewZoneKey,
  previewConstrKey,
  onPreviewZoneChange,
  onPreviewConstrChange,
  onApplyDefault,
  onResetSystemDefault,
  onCopyToAll,
  onSaveWard,
  onCellChange,
  WardRatePreview,
  RateInput,
}: UlbRateEditorWardMatrixPanelProps) {
  return (
    <GlassCard padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Editing</p>
          <h4 className="font-display text-lg font-bold text-foreground">
            Ward {selectedWard.wardNo} — {selectedWard.name}
          </h4>
          <p className="text-xs text-muted-foreground">{selectedWard.wardCode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onApplyDefault} className="cursor-pointer gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> ULB Default
          </Button>
          <Button variant="outline" size="sm" onClick={onResetSystemDefault} className="cursor-pointer gap-1.5 text-xs">
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden /> System Default
          </Button>
          <Button variant="outline" size="sm" onClick={onCopyToAll} className="cursor-pointer gap-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" aria-hidden /> Copy to All Wards
          </Button>
          <Button
            size="sm"
            onClick={onSaveWard}
            disabled={savingWard || (!selectedWardDirty && !ulbSettingsDirty)}
            className="cursor-pointer gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
          >
            {savingWard ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : wardSaved ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            {wardSaved ? "Ward Saved" : `Save Ward ${selectedWard.wardNo}`}
          </Button>
        </div>
      </div>

      <WardRatePreview
        wardNo={selectedWard.wardNo}
        matrix={wardMatrix}
        propertyTaxPct={parseFloat(form.propertyTaxPct) / 100}
        previewZoneKey={previewZoneKey}
        previewConstrKey={previewConstrKey}
        onZoneChange={onPreviewZoneChange}
        onConstrChange={onPreviewConstrChange}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-navy/15 bg-brand-navy text-white">
              <th className="sticky left-0 z-10 min-w-50 border-r border-white/10 bg-brand-navy px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide">
                Road Width
              </th>
              {TAX_RATE_CONSTRUCTION_COLS.map((col) => (
                <th key={col.key} className="min-w-28 border-l border-white/10 px-2 py-3 text-center">
                  <p className="text-[10px] font-bold">{col.label}</p>
                  <p className="mt-0.5 text-[9px] font-normal text-white/70">{col.hint}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TAX_RATE_ZONE_ROWS.map((zone, rowIdx) => (
              <tr
                key={zone.key}
                className={cn("border-b border-border/40", rowIdx % 2 === 0 ? "bg-background" : "bg-muted/10")}
              >
                <td className="sticky left-0 z-10 border-r border-border/50 bg-inherit px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{zone.label}</p>
                  <p className="text-[10px] text-muted-foreground">{zone.hint}</p>
                </td>
                {TAX_RATE_CONSTRUCTION_COLS.map((col) => (
                  <td key={col.key} className="border-l border-border/30 px-2 py-2.5">
                    <RateInput
                      value={wardMatrix[zone.key]?.[col.key] ?? ""}
                      onChange={(v) => onCellChange(zone.key, col.key, v)}
                      label={`Ward ${selectedWard.wardNo} ${zone.label} ${col.label}`}
                      className="mx-auto w-19"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 border-t border-border/50 bg-muted/15 px-5 py-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Panel rate (₹/sqft) from master; Gross ALV = area × rate × 12 · Assessable ALV = gross ALV × 80% · Property
          tax = assessable × 10% · Water = assessable × 7.5% · Drainage = assessable × 2.5% · Total demand (yearly) =
          Property tax + Water + Drainage. Open land properties: water and drainage are zero.
        </p>
      </div>
    </GlassCard>
  );
}

type UlbRateEditorTaxSettingsProps = {
  form: RateForm;
  onFormPatch: (patch: Partial<RateForm>) => void;
  combinedPctLabel: string;
};

export function UlbRateEditorTaxSettings({ form, onFormPatch, combinedPctLabel }: UlbRateEditorTaxSettingsProps) {
  return (
    <GlassCard padding="md">
      <GlassCardHeader
        title="Tax Percentages"
        description="Applied to assessable ALV (80%)"
        icon={<Percent className="h-4 w-4" aria-hidden />}
      />
      <div className="space-y-3">
        {[
          { label: "Property Tax", key: "propertyTaxPct" },
          { label: "Water Tax", key: "waterTaxPct" },
          { label: "Drainage / Sewer", key: "drainageTaxPct" },
        ].map(({ label, key }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <Label className="text-sm font-medium">{label}</Label>
            <div className="relative w-20">
              <Input
                type="number"
                step="0.1"
                value={form[key as keyof RateForm] as string}
                onChange={(e) => onFormPatch({ [key]: e.target.value } as Partial<RateForm>)}
                className="pr-6 text-right font-mono text-xs tabular-nums"
                aria-label={label}
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                %
              </span>
            </div>
          </div>
        ))}
        <Separator />
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Combined</p>
          <p className="font-mono text-lg font-bold tabular-nums">{combinedPctLabel}</p>
        </div>
      </div>
    </GlassCard>
  );
}

export function UlbRateEditorErrorBanner({ error }: { error: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      {error}
    </div>
  );
}

export function UlbRateEditorEmptyWards() {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-muted-foreground">
      <MapPin className="mx-auto mb-3 h-8 w-8 opacity-30" aria-hidden />
      <p className="font-medium text-foreground">No wards configured</p>
      <p className="mt-1 text-sm">Add wards under Tenants &amp; Wards before setting tax rates.</p>
    </div>
  );
}
