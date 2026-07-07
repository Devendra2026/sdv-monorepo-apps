"use client";

import type { ReactNode } from "react";

export function UserSheetFooter({ dirty, hint, children }: { dirty?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-border/80 bg-linear-to-t from-muted/40 to-background/95 px-5 py-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {dirty && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
          {hint ?? (dirty ? "Unsaved changes" : "All changes saved")}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
