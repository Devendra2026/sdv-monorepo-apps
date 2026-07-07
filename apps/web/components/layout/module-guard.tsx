"use client";

import { PermissionDeniedDialog } from "@/components/shared/permission-boundary";
import { isQcOnlyUser } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/sessions";
import { usePathname } from "next/navigation";

/**
 * Keeps QC-only users inside the QC portal — they cannot browse the Surveys module.
 */
export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, capabilities, isLoading } = useCurrentUser();

  if (isLoading) return null;

  const qcOnly = isQcOnlyUser(capabilities, role);
  const onSurveyModule = pathname === "/surveys" || pathname.startsWith("/surveys/");

  if (qcOnly && onSurveyModule) {
    return (
      <PermissionDeniedDialog
        title="Surveys module restricted"
        description="QC supervisors work in the Quality Control portal only. Open the QC queue to review and correct submitted surveys."
        redirectTo="/qc"
      />
    );
  }

  return <>{children}</>;
}
