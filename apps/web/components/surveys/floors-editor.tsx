"use client";

import {
  BuiltUpFloorsSection,
  FloorDraftDialog,
  OpenLandFloorsSection,
  PlinthAreaCard,
  PlotAreaCard,
} from "@/components/surveys/floors-editor-parts";
import { useFloorsEditorLogic } from "@/hooks/surveys/useFloorsEditorLogic";
import type { ConflictSurveyLinkVariant } from "@/lib/errors";
import { useImperativeHandle, type Ref } from "react";

export type FloorsEditorHandle = {
  validateArea: () => Promise<boolean>;
};

type FloorsEditorProps = {
  ref?: Ref<FloorsEditorHandle>;
  surveyId: string;
  plotSqft?: number;
  plinthSqft?: number;
  onPlotSqftChange?: (plotSqft: number) => void;
  onDirty?: () => void;
  onFloorMutatingChange?: (busy: boolean) => void;
  conflictLinkVariant?: ConflictSurveyLinkVariant;
};

export function FloorsEditor({
  ref,
  surveyId,
  plotSqft,
  plinthSqft: _initialPlinth,
  onPlotSqftChange,
  onDirty,
  onFloorMutatingChange,
  conflictLinkVariant = "surveys",
}: FloorsEditorProps) {
  const logic = useFloorsEditorLogic({
    surveyId,
    plotSqft,
    onPlotSqftChange,
    onDirty,
    onFloorMutatingChange,
    conflictLinkVariant,
  });

  useImperativeHandle(ref, () => ({ validateArea: logic.validateArea }), [logic.validateArea]);

  return (
    <div className="space-y-4">
      <PlotAreaCard
        plotDraft={logic.plotDraft}
        savingPlot={logic.savingPlot}
        onPlotChange={logic.handlePlotChange}
        onSave={logic.savePlot}
      />
      <PlinthAreaCard plinthSqft={logic.plinthFromFloors} />
      <BuiltUpFloorsSection
        floors={logic.floors}
        builtUpFloors={logic.builtUpFloors}
        openLandFloors={logic.openLandFloors}
        builtUpTotal={logic.builtUpTotal}
        floorMasters={logic.floorMasters}
        onAddFloor={() => logic.openAddFloor(false)}
        onEdit={logic.handleEditFloor}
        onRemove={logic.handleRemoveFloor}
      />
      <OpenLandFloorsSection
        floors={logic.floors}
        openLandFloors={logic.openLandFloors}
        openLandTotal={logic.openLandTotal}
        floorMasters={logic.floorMasters}
        onAddFloor={() => logic.openAddFloor(true)}
        onEdit={logic.handleEditFloor}
        onRemove={logic.handleRemoveFloor}
      />
      <FloorDraftDialog
        draft={logic.draft}
        opts={logic.opts}
        onClose={() => logic.setDraft(null)}
        onChange={logic.setDraft}
        onSave={logic.saveFloor}
      />
    </div>
  );
}
