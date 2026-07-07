"use client";

import { QcRemarksThread } from "@/components/qc/qc-remarks-thread";
import { Badge } from "@/components/ui/badge";
import type { QcRemarkWithAuthor } from "@/schema/qc/index";
import { AlertTriangle } from "lucide-react";

export function QcCorrectionBanner({ remarks }: { remarks?: QcRemarkWithAuthor[] }) {
  if (!remarks?.length) return null;

  const openRemarks = remarks.filter((r) => r.status === "open");
  if (openRemarks.length === 0) return null;

  const taggedSections = [...new Set(openRemarks.flatMap((r) => r.taggedSections))];

  return (
    <div className="rounded-2xl border border-rose-300/60 bg-linear-to-r from-rose-50 via-orange-50 to-amber-50 px-5 py-4 shadow-sm dark:border-rose-800/40 dark:from-rose-950/40 dark:via-orange-950/30 dark:to-amber-950/20">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-rose-900 dark:text-rose-100">
            QC corrections required ({openRemarks.length} open remark{openRemarks.length !== 1 ? "s" : ""})
          </p>
          <p className="mt-0.5 text-xs text-rose-700/80 dark:text-rose-300/80">
            Address the feedback below, then save and re-submit for QC review.
          </p>
          {taggedSections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {taggedSections.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="border-rose-300 text-[10px] capitalize dark:border-rose-700"
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <QcRemarksThread remarks={openRemarks} compact />
    </div>
  );
}
