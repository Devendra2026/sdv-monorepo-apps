"use client";

import type { FloorDraft } from "@/components/surveys/floors-editor-parts";
import { useMasters } from "@/hooks/masters/useMasters";
import { useFloors, useRemoveFloor, useUpsertFloor } from "@/hooks/surveys/useFloors";
import { useSaveDraft, useSurvey } from "@/hooks/surveys/useSurveys";
import { parseConvexError, toastSurveyConflict, type ConflictSurveyLinkVariant } from "@/lib/errors";
import {
  builtUpSqftFromFloors,
  isOpenLandFloor,
  openLandSqftFromFloors,
  plinthSqftFromFloors,
  plotPlinthConflict,
} from "@/lib/survey/area";
import type { FloorRow } from "@/schema/surveys/index";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const newId = () => `flr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export type UseFloorsEditorLogicArgs = {
  surveyId: string;
  plotSqft?: number;
  onPlotSqftChange?: (plotSqft: number) => void;
  onDirty?: () => void;
  onFloorMutatingChange?: (busy: boolean) => void;
  conflictLinkVariant?: ConflictSurveyLinkVariant;
};

export function useFloorsEditorLogic({
  surveyId,
  plotSqft: initialPlot,
  onPlotSqftChange,
  onDirty,
  onFloorMutatingChange,
  conflictLinkVariant = "surveys",
}: UseFloorsEditorLogicArgs) {
  const router = useRouter();
  const floors = useFloors(surveyId) as FloorRow[] | undefined;
  const survey = useSurvey(surveyId);
  const upsert = useUpsertFloor();
  const remove = useRemoveFloor();
  const saveDraft = useSaveDraft();
  const { masters } = useMasters({ includeTenantCatalog: false });
  const [draft, setDraft] = useState<FloorDraft | null>(null);
  const [savingPlot, setSavingPlot] = useState(false);
  /** Local edits only — server value comes from `initialPlot` (parent remounts via `key={surveyId}`). */
  const [plotOverride, setPlotOverride] = useState<number | null>(null);
  const plotDraft = plotOverride ?? initialPlot ?? 0;

  const builtUpFloors = useMemo(() => (floors ?? []).filter((f) => !isOpenLandFloor(f.floorName)), [floors]);
  const openLandFloors = useMemo(() => (floors ?? []).filter((f) => isOpenLandFloor(f.floorName)), [floors]);
  const builtUpTotal = builtUpSqftFromFloors(floors ?? []);
  const openLandTotal = openLandSqftFromFloors(floors ?? []);
  const plinthFromFloors = plinthSqftFromFloors(floors ?? []);

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  const surveyRef = useRef(survey);
  surveyRef.current = survey;
  const plotSqftRef = useRef(plotDraft);
  plotSqftRef.current = plotDraft;
  const plinthRef = useRef(plinthFromFloors);
  plinthRef.current = plinthFromFloors;
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  const conflictLinkVariantRef = useRef(conflictLinkVariant);
  conflictLinkVariantRef.current = conflictLinkVariant;
  const routerRef = useRef(router);
  routerRef.current = router;
  const onFloorMutatingChangeRef = useRef(onFloorMutatingChange);
  onFloorMutatingChangeRef.current = onFloorMutatingChange;

  async function withFloorMutation<T>(fn: () => Promise<T>): Promise<T> {
    onFloorMutatingChangeRef.current?.(true);
    try {
      return await fn();
    } finally {
      onFloorMutatingChangeRef.current?.(false);
    }
  }

  const opts = {
    floors: masters?.floors ?? [],
    usageFactors: masters?.usageFactors ?? [],
    usageTypes: masters?.usageTypes ?? [],
    construction: masters?.constructionTypes ?? [],
  };

  function resolvePlinthSqft(currentSurvey: NonNullable<typeof survey>): number {
    if (plinthRef.current > 0) return plinthRef.current;
    if ((floorsRef.current?.length ?? 0) > 0) return 0;
    return currentSurvey.plinthSqft || 0;
  }

  const validatePlotArea = useCallback((plot: number, currentSurvey: NonNullable<typeof survey>): boolean => {
    if (!(plot > 0)) {
      toast.error("Enter plot area greater than 0.");
      return false;
    }
    const plinth = resolvePlinthSqft(currentSurvey);
    const conflict = plotPlinthConflict(plot, plinth);
    if (conflict) {
      toast.error(conflict);
      return false;
    }
    return true;
  }, []);

  const validateArea = useCallback(async (): Promise<boolean> => {
    const currentSurvey = surveyRef.current;
    if (!currentSurvey) return false;
    return validatePlotArea(plotSqftRef.current, currentSurvey);
  }, [validatePlotArea]);

  const persistPlotArea = useCallback(
    async (plot: number): Promise<boolean> => {
      const currentSurvey = surveyRef.current;
      if (!currentSurvey) return false;
      if (!validatePlotArea(plot, currentSurvey)) return false;
      try {
        await saveDraftRef.current({
          id: (surveyId ?? currentSurvey._id) as any,
          localId: currentSurvey.localId,
          municipalityId: currentSurvey.municipalityId,
          clientUpdatedAt: Date.now(),
          plotSqft: plot,
          plinthSqft: resolvePlinthSqft(currentSurvey),
        } as any);
        return true;
      } catch (e) {
        if (
          !toastSurveyConflict(e, {
            variant: conflictLinkVariantRef.current,
            onNavigate: (href) => routerRef.current.push(href),
          })
        ) {
          toast.error(parseConvexError(e).message);
        }
        return false;
      }
    },
    [surveyId, validatePlotArea],
  );

  async function savePlot() {
    if (!survey) return;
    setSavingPlot(true);
    try {
      const ok = await persistPlotArea(plotDraft);
      if (ok) {
        setPlotOverride(null);
        toast.success("Plot area saved");
      }
    } finally {
      setSavingPlot(false);
    }
  }

  async function saveFloor() {
    if (!draft) return;
    await withFloorMutation(async () => {
      try {
        await upsert({
          surveyId: surveyId as any,
          clientFloorId: draft.clientFloorId,
          position: draft.position,
          floorName: draft.floorName,
          usageFactor: draft.usageFactor || undefined,
          usageType: draft.usageType,
          constructionType: draft.constructionType,
          isOccupied: draft.usageType === "self_occupied" || draft.usageType === "rented",
          areaSqft: draft.areaSqft,
        });
        toast.success("Floor saved");
        setDraft(null);
      } catch (e) {
        toast.error(parseConvexError(e).message);
      }
    });
  }

  function openAddFloor(isOpenLand: boolean) {
    setDraft({
      clientFloorId: newId(),
      position: (floors?.length ?? 0) + 1,
      floorName: isOpenLand ? "open_land" : "",
      usageType: "",
      constructionType: isOpenLand ? "open_land_plot" : "",
      areaSqft: 0,
    });
  }

  async function handleRemoveFloor(id: string) {
    if (!confirm("Remove this floor row?")) return;
    await withFloorMutation(async () => {
      try {
        await remove({ id: id as any });
        toast.success("Floor removed");
      } catch (e) {
        toast.error(parseConvexError(e).message);
      }
    });
  }

  function handlePlotChange(value: number) {
    setPlotOverride(value);
    onPlotSqftChange?.(value);
    onDirty?.();
  }

  function handleEditFloor(f: FloorRow) {
    setDraft({ ...f, usageFactor: f.usageFactor });
  }

  const floorMasters = {
    floors: masters?.floors,
    usageFactors: masters?.usageFactors,
    usageTypes: masters?.usageTypes,
    constructionTypes: masters?.constructionTypes,
  };

  return {
    floors,
    draft,
    setDraft,
    plotDraft,
    savingPlot,
    builtUpFloors,
    openLandFloors,
    builtUpTotal,
    openLandTotal,
    plinthFromFloors,
    floorMasters,
    opts,
    validateArea,
    savePlot,
    saveFloor,
    openAddFloor,
    handleRemoveFloor,
    handlePlotChange,
    handleEditFloor,
  };
}
