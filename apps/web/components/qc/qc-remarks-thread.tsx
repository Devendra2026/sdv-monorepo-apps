"use client";

import { RoleGate } from "@/components/shared/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResolveRemark } from "@/hooks/qc/useQc";
import { fmtDate } from "@/lib/utils";
import type { QcRemarkWithAuthor } from "@/schema/qc/index";
import { MessageSquare } from "lucide-react";

export function QcRemarksThread({ remarks, compact = false }: { remarks?: QcRemarkWithAuthor[]; compact?: boolean }) {
  const resolveRemark = useResolveRemark();

  if (remarks === undefined) {
    return <p className="text-sm text-muted-foreground">Loading remarks…</p>;
  }

  if (remarks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
        No QC remarks yet.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${compact ? "" : "max-h-[480px] overflow-y-auto pr-1"}`}>
      {remarks.map((r) => (
        <div
          key={r._id}
          className={`rounded-xl border p-3 ${
            r.status === "open"
              ? "border-amber-300/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20"
              : "border-border/60 bg-background/60"
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">{r.author?.name ?? "Unknown"}</span>
              <Badge variant="outline" className="text-[10px]">
                {r.authorRole.charAt(0).toUpperCase() + r.authorRole.slice(1)}
              </Badge>
              <Badge variant={r.status === "open" ? "outline" : "secondary"} className="text-[10px]">
                {r.status}
              </Badge>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(r._creationTime)}</span>
          </div>
          <p className="text-sm leading-relaxed">{r.message}</p>
          {r.taggedSections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {r.taggedSections.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px] capitalize">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {r.status === "open" && (
            <RoleGate capability="qc.decide" fallback={null}>
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                onClick={() => resolveRemark({ id: r._id })}
              >
                Mark resolved
              </Button>
            </RoleGate>
          )}
        </div>
      ))}
    </div>
  );
}
