"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Modal shown when a user navigates to a page they cannot access.
 * Dismissal returns them to the dashboard — keeps the shell visible underneath.
 */
export function PermissionDeniedDialog({
  open = true,
  title = "Access Denied",
  description = "You don't have permission to view this content.",
  hint = "Contact your administrator if you believe you should have access.",
  redirectTo = "/dashboard",
  onDismiss,
}: {
  open?: boolean;
  title?: string;
  description?: string;
  hint?: string;
  redirectTo?: string;
  onDismiss?: () => void;
}) {
  const router = useRouter();

  function dismiss() {
    onDismiss?.();
    router.push(redirectTo);
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="h-6 w-6 text-destructive/70" />
          </div>
          <AlertDialogTitle className="font-display text-lg">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-balance">{description}</AlertDialogDescription>
          {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={dismiss}>Return to Dashboard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
