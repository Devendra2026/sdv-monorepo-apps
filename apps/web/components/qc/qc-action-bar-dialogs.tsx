"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type QcDeleteSurveyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyLabel: string;
  isWorking: boolean;
  onConfirm: () => void;
};

export function QcDeleteSurveyDialog({
  open,
  onOpenChange,
  propertyLabel,
  isWorking,
  onConfirm,
}: QcDeleteSurveyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Delete survey?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <strong>{propertyLabel}</strong>. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isWorking}
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
