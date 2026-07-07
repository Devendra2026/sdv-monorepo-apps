"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAreaSqft } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import type { FloorRow } from "@/schema/surveys/index";
import { Pencil, Plus, Trash2 } from "lucide-react";

export type FloorDraft = {
  clientFloorId: string;
  position: number;
  floorName: string;
  usageFactor?: string;
  usageType: string;
  constructionType: string;
  areaSqft: number;
};

export type FloorMasters = {
  floors?: { value: string; label: string }[];
  usageFactors?: { value: string; label: string }[];
  usageTypes?: { value: string; label: string }[];
  constructionTypes?: { value: string; label: string }[];
};

export function PlotAreaCard({
  plotDraft,
  savingPlot,
  onPlotChange,
  onSave,
}: {
  plotDraft: number;
  savingPlot: boolean;
  onPlotChange: (value: number) => void;
  onSave: () => void;
}) {
  return (
    <GlassCard padding="md">
      <GlassCardHeader title="Plot area" description="Total plot size on ground (sq ft)." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 space-y-1.5">
          <Label>Plot (sqft)</Label>
          <Input type="number" value={plotDraft || ""} onChange={(e) => onPlotChange(Number(e.target.value))} />
        </div>
        <Button size="sm" disabled={savingPlot} onClick={onSave} className="cursor-pointer rounded-xl">
          {savingPlot ? "Saving…" : "Save plot area"}
        </Button>
      </div>
    </GlassCard>
  );
}

export function PlinthAreaCard({ plinthSqft }: { plinthSqft: number }) {
  return (
    <GlassCard padding="md" variant="accent">
      <GlassCardHeader title="Plinth area" description="Calculated from ground floor row." />
      <p className="font-display text-2xl font-bold tabular-nums text-brand-navy dark:text-primary-foreground">
        {formatAreaSqft(plinthSqft)}
      </p>
    </GlassCard>
  );
}

export function BuiltUpFloorsSection({
  floors,
  builtUpFloors,
  openLandFloors,
  builtUpTotal,
  floorMasters,
  onAddFloor,
  onEdit,
  onRemove,
}: {
  floors: FloorRow[] | undefined;
  builtUpFloors: FloorRow[];
  openLandFloors: FloorRow[];
  builtUpTotal: number;
  floorMasters: FloorMasters;
  onAddFloor: () => void;
  onEdit: (f: FloorRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <GlassCard padding="md">
      <GlassCardHeader
        title="Built-up floors"
        description="Ground floor, first floor, and other constructed levels."
        action={
          <Button size="sm" onClick={onAddFloor} className="cursor-pointer rounded-xl">
            <Plus className="h-4 w-4" aria-hidden /> Add floor
          </Button>
        }
      />
      <div className="space-y-3">
        {floors === undefined ? null : builtUpFloors.length === 0 ? (
          <EmptyState
            title={openLandFloors.length > 0 ? "No built-up floors" : "Built-up floor required"}
            description={
              openLandFloors.length > 0
                ? "Vacant plots can submit with open land only. Add floors here if the property has construction."
                : "Add at least one floor row — built-up floors or open land — with area greater than 0."
            }
          />
        ) : (
          <FloorTable floors={builtUpFloors} masters={floorMasters} onEdit={onEdit} onRemove={onRemove} />
        )}
        <div className="rounded-xl border border-brand-navy/15 bg-brand-navy/5 px-4 py-3 dark:border-primary/20 dark:bg-primary/10">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Total built-up area</p>
          <p className="font-mono text-xl font-bold tabular-nums text-brand-navy dark:text-primary-foreground">
            {formatAreaSqft(builtUpTotal)}
          </p>
          <p className="text-xs text-muted-foreground">Sum of all floor rows except open land.</p>
        </div>
      </div>
    </GlassCard>
  );
}

export function OpenLandFloorsSection({
  floors,
  openLandFloors,
  openLandTotal,
  floorMasters,
  onAddFloor,
  onEdit,
  onRemove,
}: {
  floors: FloorRow[] | undefined;
  openLandFloors: FloorRow[];
  openLandTotal: number;
  floorMasters: FloorMasters;
  onAddFloor: () => void;
  onEdit: (f: FloorRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <GlassCard padding="md">
      <GlassCardHeader
        title="Open land area"
        description="Vacant or undeveloped plot area — separate from built-up floors."
        action={
          <Button size="sm" variant="outline" onClick={onAddFloor} className="cursor-pointer rounded-xl">
            <Plus className="h-4 w-4" aria-hidden /> Add open land
          </Button>
        }
      />
      <div className="space-y-3">
        {floors === undefined ? null : openLandFloors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open land rows. Add one if part of the plot is vacant.</p>
        ) : (
          <FloorTable floors={openLandFloors} masters={floorMasters} onEdit={onEdit} onRemove={onRemove} />
        )}
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Total open land area</p>
          <p className="font-mono text-xl font-bold tabular-nums">{formatAreaSqft(openLandTotal)}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function FloorTable({
  floors,
  masters,
  onEdit,
  onRemove,
}: {
  floors: FloorRow[];
  masters?: FloorMasters;
  onEdit: (f: FloorRow) => void;
  onRemove: (id: string) => void;
}) {
  if (floors.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No rows yet.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-brand-navy/10 bg-linear-to-r from-brand-navy/6 via-muted/25 to-brand-navy/4 hover:from-brand-navy/6 dark:border-primary/15 dark:from-primary/12 dark:via-muted/10 dark:to-primary/6">
            <TableHead className="w-14 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              S. No
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Floor
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Usage type
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Usage factor
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Construction
            </TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Area
            </TableHead>
            <TableHead className="w-24 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {floors.map((f, i) => (
            <TableRow
              key={f._id}
              className={`border-b border-border/40 last:border-b-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/20 dark:bg-muted/10"}`}
            >
              <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium capitalize">{labelFromOptions(masters?.floors, f.floorName)}</TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {labelFromOptions(masters?.usageTypes, f.usageType)}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {labelFromOptions(masters?.usageFactors, f.usageFactor)}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {labelFromOptions(masters?.constructionTypes, f.constructionType)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {formatAreaSqft(f.areaSqft)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 cursor-pointer rounded-lg px-2 transition-colors duration-200 hover:bg-brand-navy/10 dark:hover:bg-primary/15"
                    onClick={() => onEdit(f)}
                    aria-label={`Edit floor ${i + 1}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only sm:not-sr-only sm:ml-1">Edit</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 cursor-pointer rounded-lg transition-colors duration-200 hover:bg-brand-red/10"
                    onClick={() => onRemove(f._id)}
                    aria-label={`Delete floor ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-brand-red" aria-hidden />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type FloorDraftDialogProps = {
  draft: FloorDraft | null;
  opts: {
    floors: { value: string; label: string }[];
    usageFactors: { value: string; label: string }[];
    usageTypes: { value: string; label: string }[];
    construction: { value: string; label: string }[];
  };
  onClose: () => void;
  onChange: (draft: FloorDraft) => void;
  onSave: () => void;
};

function applyFloorNameChange(draft: FloorDraft, floorName: string): FloorDraft {
  if (floorName === "open_land") {
    return { ...draft, floorName, constructionType: "open_land_plot" };
  }
  const constructionType =
    draft.floorName === "open_land" && draft.constructionType === "open_land_plot" ? "" : draft.constructionType;
  return { ...draft, floorName, constructionType };
}

export function FloorDraftDialog({ draft, opts, onClose, onChange, onSave }: FloorDraftDialogProps) {
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl border-border/70 shadow-premium-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-base">
            {draft?.floorName === "open_land" ? "Open land row" : "Floor details"}
          </DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Floor">
              <Sel
                value={draft.floorName}
                onChange={(v) => onChange(applyFloorNameChange(draft, v))}
                options={opts.floors}
                placeholder="Select floor"
              />
            </Field>
            <Field label="Usage type">
              <Sel
                value={draft.usageType}
                onChange={(v) => onChange({ ...draft, usageType: v })}
                options={opts.usageTypes}
                placeholder="Select usage type"
              />
            </Field>
            <Field label="Usage factor">
              <Sel
                value={draft.usageFactor ?? ""}
                onChange={(v) => onChange({ ...draft, usageFactor: v })}
                options={opts.usageFactors}
                placeholder="Select usage factor"
              />
            </Field>
            <Field label="Construction">
              <Sel
                value={draft.constructionType}
                onChange={(v) => onChange({ ...draft, constructionType: v })}
                options={opts.construction}
                placeholder="Select construction"
              />
            </Field>
            <Field label="Area (sqft)">
              <Input
                type="number"
                min={0}
                value={draft.areaSqft || ""}
                onChange={(e) => onChange({ ...draft, areaSqft: Number(e.target.value) })}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Position">
              <Input
                type="number"
                min={1}
                value={draft.position}
                onChange={(e) => onChange({ ...draft, position: Number(e.target.value) })}
                className="font-mono tabular-nums"
              />
            </Field>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="cursor-pointer rounded-xl transition-colors duration-200"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!draft?.floorName || !draft?.usageType || !draft?.constructionType || !(draft?.areaSqft > 0)}
            className="cursor-pointer rounded-xl bg-brand-navy text-white transition-colors duration-200 hover:bg-brand-navy/90 dark:bg-primary dark:hover:bg-primary/90"
          >
            Save floor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Sel({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="cursor-pointer rounded-xl">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="cursor-pointer">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
