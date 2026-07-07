"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { DraftReassignFilters } from "@/hooks/surveys/useSurveyReassignment";
import { useDraftOwners, useReassignDrafts } from "@/hooks/surveys/useSurveyReassignment";
import { useHasCapability } from "@/hooks/use-capability";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { parseConvexError } from "@/lib/errors";
import { useQuery } from "convex/react";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ALL = "__all__";

export function SurveyReassignDialog({
  open,
  onOpenChange,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: DraftReassignFilters;
}) {
  const ready = useConvexAuthReady();
  const canReassign = useHasCapability("surveys.reassign");
  const draftOwners = useDraftOwners(scope);
  const reassign = useReassignDrafts();
  const { page: fieldUserPage } =
    useQuery(
      api.admin.listUsers,
      ready && canReassign && open
        ? {
            paginationOpts: { numItems: 200, cursor: null },
            status: "active",
          }
        : "skip",
    ) ?? {};

  const [mode, setMode] = useState<"fromSurveyor" | "orphaned">("fromSurveyor");
  const [fromSurveyorId, setFromSurveyorId] = useState<string>(ALL);
  const [toSurveyorId, setToSurveyorId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const targetOptions = useMemo(() => {
    const rows = fieldUserPage ?? [];
    return rows.filter((u) => u.role === "surveyor" || u.role === "supervisor");
  }, [fieldUserPage]);

  const sourceOptions = useMemo(() => {
    const owners = draftOwners?.owners ?? [];
    if (mode === "orphaned") {
      return owners.filter((o) => o.isOrphaned);
    }
    return owners.filter((o) => !o.isOrphaned);
  }, [draftOwners, mode]);

  const selectedSource = sourceOptions.find((o) => o.surveyorId === fromSurveyorId);
  const transferCount = mode === "orphaned" ? (draftOwners?.orphanedCount ?? 0) : (selectedSource?.draftCount ?? 0);

  async function submit() {
    if (!toSurveyorId) {
      toast.error("Select the surveyor who will receive these drafts");
      return;
    }
    if (mode === "fromSurveyor" && fromSurveyorId === ALL) {
      toast.error("Select the surveyor whose drafts should move");
      return;
    }

    setBusy(true);
    try {
      const result = await reassign({
        toSurveyorId: toSurveyorId as Id<"users">,
        mode: mode === "orphaned" ? "orphaned" : "fromSurveyor",
        fromSurveyorId: mode === "fromSurveyor" && fromSurveyorId !== ALL ? (fromSurveyorId as Id<"users">) : undefined,
        districtId: scope.districtId as Id<"districts"> | undefined,
        municipalityId: scope.municipalityId as Id<"municipalities"> | undefined,
        wardNo: scope.wardNo,
      });
      const adjusted = result.localIdAdjusted > 0 ? ` (${result.localIdAdjusted} local IDs adjusted for sync)` : "";
      toast.success(`Transferred ${result.transferred} draft${result.transferred === 1 ? "" : "s"}${adjusted}`);
      onOpenChange(false);
      setFromSurveyorId(ALL);
      setToSurveyorId("");
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" aria-hidden />
            Reassign draft surveys
          </DialogTitle>
          <DialogDescription>
            Move in-progress field data to another surveyor. Prior assignee details stay in the audit log only — the new
            surveyor sees the drafts as their own.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => {
            setMode(v as "fromSurveyor" | "orphaned");
            setFromSurveyorId(ALL);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fromSurveyor">From surveyor</TabsTrigger>
            <TabsTrigger value="orphaned" className="gap-1.5">
              Orphaned
              {(draftOwners?.orphanedCount ?? 0) > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {draftOwners?.orphanedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "orphaned" && (draftOwners?.orphanedCount ?? 0) > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {draftOwners?.orphanedCount} draft
              {(draftOwners?.orphanedCount ?? 0) === 1 ? "" : "s"} belong to disabled or departed field staff and can be
              reassigned without naming the original surveyor.
            </p>
          </div>
        )}

        {mode === "fromSurveyor" && (
          <div className="space-y-2">
            <Label>From surveyor</Label>
            <Select value={fromSurveyorId} onValueChange={setFromSurveyorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source surveyor" />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.length === 0 ? (
                  <SelectItem value={ALL} disabled>
                    No draft surveys in current filters
                  </SelectItem>
                ) : (
                  sourceOptions.map((o) => (
                    <SelectItem key={o.surveyorId} value={o.surveyorId}>
                      {o.name} · {o.draftCount} draft{o.draftCount === 1 ? "" : "s"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>To surveyor</Label>
          <Select value={toSurveyorId} onValueChange={setToSurveyorId}>
            <SelectTrigger>
              <SelectValue placeholder="Select target surveyor" />
            </SelectTrigger>
            <SelectContent>
              {targetOptions.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.name} · {u.role}
                  {u.municipalityName ? ` · ${u.municipalityName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          {transferCount > 0
            ? `${transferCount} draft${transferCount === 1 ? "" : "s"} will transfer within the active filter scope.`
            : "No drafts match the current scope."}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy || transferCount === 0 || !toSurveyorId}>
            {busy ? "Transferring…" : "Transfer drafts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
