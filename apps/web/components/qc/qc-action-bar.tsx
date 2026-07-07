"use client";

import { QcDeleteSurveyDialog } from "@/components/qc/qc-action-bar-dialogs";
import { QcActionBarProgress } from "@/components/qc/qc-action-bar-progress";
import { QcActionBarToolbar } from "@/components/qc/qc-action-bar-toolbar";
import {
  EMPTY_QC_SCOPE,
  getQcStatusHint,
  resolveQcToolbarVariant,
  type QcActionBarProps,
} from "@/components/qc/qc-action-bar.types";
import { useQcActionBar } from "@/hooks/qc/useQcActionBar";

export function QcActionBar({
  survey,
  nextSurvey,
  scope = EMPTY_QC_SCOPE,
  mode = "review",
  correctionsSaved = false,
  onSave,
  saving = false,
  onCorrectionsSaved,
}: QcActionBarProps) {
  const actions = useQcActionBar({
    survey,
    nextSurvey,
    scope,
    mode,
    correctionsSaved,
    onSave,
    saving,
    onCorrectionsSaved,
  });

  const hint = getQcStatusHint(mode, survey, correctionsSaved);
  const toolbarVariant = resolveQcToolbarVariant(mode, survey, correctionsSaved);

  return (
    <>
      <section
        className="premium-card sticky bottom-0 z-20 overflow-hidden rounded-2xl border border-amber-500/25 bg-card/95 shadow-premium-lg backdrop-blur-md dark:border-amber-400/20"
        aria-label={mode === "edit" ? "QC correction actions" : "QC review actions"}
      >
        <QcActionBarProgress isApproved={actions.isApproved} correctionsSaved={correctionsSaved} mode={mode} />

        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 sm:py-4">
          {hint && <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{hint}</p>}

          <QcActionBarToolbar
            survey={survey}
            variant={toolbarVariant}
            isWorking={actions.isWorking}
            saving={saving}
            onDeleteOpen={() => actions.setDeleteOpen(true)}
            onReopen={() => void actions.handleReopen()}
            onSave={actions.handleSave}
            onApprove={actions.handleApprove}
          />
        </div>
      </section>

      <QcDeleteSurveyDialog
        open={actions.deleteOpen}
        onOpenChange={actions.setDeleteOpen}
        propertyLabel={actions.propertyLabel}
        isWorking={actions.isWorking}
        onConfirm={() => void actions.handleDelete()}
      />
    </>
  );
}
