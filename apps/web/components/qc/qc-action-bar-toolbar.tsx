"use client";

import type { QcToolbarVariant } from "@/components/qc/qc-action-bar.types";
import { qcActionBtn } from "@/components/qc/qc-action-styles";
import { RoleGate } from "@/components/shared/role-gate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SurveyListItem } from "@/schema/surveys/index";
import { CheckCircle2, Eye, Loader2, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import Link from "next/link";

type QcActionBarToolbarProps = {
  survey: Pick<SurveyListItem, "_id" | "status" | "qcStatus">;
  variant: QcToolbarVariant;
  isWorking: boolean;
  saving: boolean;
  onDeleteOpen: () => void;
  onReopen: () => void;
  onSave: () => void;
  onApprove: () => void;
};

export function QcActionBarToolbar({
  survey,
  variant,
  isWorking,
  saving,
  onDeleteOpen,
  onReopen,
  onSave,
  onApprove,
}: QcActionBarToolbarProps) {
  const isApproved = variant === "approved";
  const showEditLink = variant === "review-pending" || variant === "review-blocked";
  const showReviewLink = variant === "edit-needs-save" || variant === "edit-ready" || variant === "edit-blocked";
  const showSave = variant === "edit-needs-save";
  const showDecide = variant === "review-pending" || variant === "edit-ready";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <RoleGate capability="surveys.delete" fallback={null}>
          {!isApproved && (
            <Button
              type="button"
              variant="ghost"
              disabled={isWorking}
              onClick={onDeleteOpen}
              className={cn(qcActionBtn.base, qcActionBtn.delete)}
              aria-label="Delete survey"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </Button>
          )}
        </RoleGate>

        {showEditLink && (
          <RoleGate capability="qc.review" fallback={null}>
            <Button asChild variant="outline" className={cn(qcActionBtn.base, qcActionBtn.edit)}>
              <Link href={`/qc/${survey._id}/edit`}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Link>
            </Button>
          </RoleGate>
        )}

        {showReviewLink && (
          <Button asChild variant="outline" className={cn(qcActionBtn.base, qcActionBtn.secondary)}>
            <Link href={`/qc/${survey._id}`}>
              <Eye className="h-4 w-4" aria-hidden />
              Review
            </Link>
          </Button>
        )}

        {isApproved && (
          <RoleGate capability="qc.reopen" fallback={null}>
            <Button
              type="button"
              variant="outline"
              disabled={isWorking}
              onClick={onReopen}
              className={cn(qcActionBtn.base, qcActionBtn.reopen)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reopen for review
            </Button>
          </RoleGate>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {showSave && (
          <RoleGate anyOf={["surveys.editDraft", "qc.review"]} fallback={null}>
            <Button
              type="button"
              disabled={isWorking}
              onClick={() => void onSave()}
              className={cn(qcActionBtn.base, qcActionBtn.save, isWorking && "opacity-80")}
            >
              {saving || isWorking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {saving ? "Saving…" : "Save"}
            </Button>
          </RoleGate>
        )}

        {showDecide && (
          <RoleGate capability="qc.decide" fallback={null}>
            <Button
              type="button"
              disabled={isWorking}
              onClick={() => void onApprove()}
              className={cn(qcActionBtn.base, qcActionBtn.approve)}
            >
              {isWorking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              )}
              Approved
            </Button>
          </RoleGate>
        )}
      </div>
    </div>
  );
}
