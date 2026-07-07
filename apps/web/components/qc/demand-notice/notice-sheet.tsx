"use client";

import type { ReactNode } from "react";

function densityClassForFloors(floorCount?: number): string | undefined {
  if (floorCount === undefined) return undefined;
  if (floorCount >= 6) return "dn-floors-extra";
  if (floorCount >= 4) return "dn-floors-many";
  return undefined;
}

export function DemandNoticeSheet({ children, floorCount }: { children: ReactNode; floorCount?: number }) {
  const densityClass = densityClassForFloors(floorCount);

  return (
    <article
      className={`demand-notice-document demand-notice-sheet a4-page relative mx-auto w-full max-w-480 overflow-hidden rounded-2xl border border-(--dn-border) bg-white shadow-premium-lg print:max-w-(--dn-content-w,194mm) print:rounded-none print:border-0 print:shadow-none${densityClass ? ` ${densityClass}` : ""}`}
      data-floors={floorCount}
    >
      <div className="demand-notice-print-viewport">
        <div className="demand-notice-print-scaler">{children}</div>
      </div>
    </article>
  );
}

export function DemandNoticeBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`demand-notice-sheet-body relative z-1 space-y-(--dn-space-4,16px) bg-white p-(--dn-space-4,16px) sm:p-(--dn-space-5,24px) ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
