"use client";

import Image from "next/image";

import { DEMAND_NOTICE_GOVT_LOGO } from "./shared";

export function NoticeWatermark({ ulbName }: { ulbName: string }) {
  return (
    <div className="demand-notice-watermark pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="demand-notice-watermark-text demand-notice-hi">{ulbName}</div>
    </div>
  );
}

export function NoticeLogo({ logoUrl }: { ulbName: string; logoUrl?: string | null }) {
  return (
    <div className="demand-notice-header-logo-mark h-20 w-20 shrink-0 overflow-hidden rounded-full print:h-[18mm] print:w-[18mm]">
      <Image
        src={logoUrl ?? DEMAND_NOTICE_GOVT_LOGO}
        alt="Government of Uttar Pradesh emblem"
        width={80}
        height={80}
        priority
        unoptimized
        className="h-full w-full object-cover"
      />
    </div>
  );
}
