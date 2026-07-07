"use client";

import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="demand-notice-print-hide mb-(--dn-space-3,12px) text-[11px] font-bold uppercase tracking-[0.14em] text-(--dn-secondary)">
      {children}
    </h2>
  );
}
