"use client";

import { pct } from "@/components/masters/tax-rates-form-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeFloorPropertyTax } from "@/lib/qc/property-tax-calc";
import { TAX_RATE_CONSTRUCTION_COLS, TAX_RATE_ZONE_ROWS } from "@/lib/qc/tax-rate-defaults";
import { f2, type RateMatrixMonthlyForm } from "@/lib/qc/tax-rate-matrix";
import { cn } from "@/lib/utils";

export type WardRatePreviewProps = {
  wardNo: string;
  matrix: RateMatrixMonthlyForm;
  propertyTaxPct: number;
  previewZoneKey: string;
  previewConstrKey: string;
  onZoneChange: (key: string) => void;
  onConstrChange: (key: string) => void;
};

export function WardRatePreview({
  wardNo,
  matrix,
  propertyTaxPct,
  previewZoneKey,
  previewConstrKey,
  onZoneChange,
  onConstrChange,
}: WardRatePreviewProps) {
  const zone = TAX_RATE_ZONE_ROWS.find((z) => z.key === previewZoneKey) ?? TAX_RATE_ZONE_ROWS[0];
  const construction =
    TAX_RATE_CONSTRUCTION_COLS.find((c) => c.key === previewConstrKey) ?? TAX_RATE_CONSTRUCTION_COLS[0];
  const panelRate = parseFloat(matrix[zone.key]?.[construction.key] || "0");
  const exampleArea = 594;
  const { alv, assessableAlv, tax } = computeFloorPropertyTax(exampleArea, panelRate, propertyTaxPct);

  return (
    <div className="space-y-3 border-b border-border/50 bg-emerald-50/50 px-5 py-4 dark:bg-emerald-950/15">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Road width</Label>
          <Select value={previewZoneKey} onValueChange={onZoneChange}>
            <SelectTrigger className="h-8 w-44 cursor-pointer text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAX_RATE_ZONE_ROWS.map((z) => (
                <SelectItem key={z.key} value={z.key} className="cursor-pointer text-xs">
                  {z.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Construction</Label>
          <Select value={previewConstrKey} onValueChange={onConstrChange}>
            <SelectTrigger className="h-8 w-44 cursor-pointer text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAX_RATE_CONSTRUCTION_COLS.map((c) => (
                <SelectItem key={c.key} value={c.key} className="cursor-pointer text-xs">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Ward {wardNo} preview · matches demand notice lookup</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/40 bg-card/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selected zone</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{zone.label}</p>
          <p className="text-[10px] text-muted-foreground">{construction.label}</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Annual rate</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">₹{f2(panelRate)}/sqft</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Gross ALV @ {exampleArea} sqft
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">
            ₹{alv.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Taxable 80%: ₹{assessableAlv.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-card/80 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Property tax ({pct(propertyTaxPct)})
          </p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            ₹{tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}

export type RateInputProps = {
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
};

export function RateInput({ value, onChange, label, className = "" }: RateInputProps) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
        ₹
      </span>
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-9 pl-6 font-mono text-xs tabular-nums text-right"
      />
    </div>
  );
}
