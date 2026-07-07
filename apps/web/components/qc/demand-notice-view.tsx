"use client";

import { PageTransition } from "@/components/design-system/motion";
import { DemandNoticeDocument } from "@/components/qc/demand-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useDemandNoticePrintFit } from "@/hooks/qc/useDemandNoticePrintFit";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import type { DemandNoticeDocumentProps } from "@/lib/qc/demand-notice-document-types";
import type { SurveyDetail } from "@/schema/surveys/index";
import { useQuery as useConvexQuery } from "convex/react";
import { ArrowLeft, Printer } from "lucide-react";
import { Geist, JetBrains_Mono, Noto_Sans_Devanagari } from "next/font/google";
import Link from "next/link";

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

type DemandNoticeViewProps = {
  survey: SurveyDetail;
  surveyId: string;
  backHref?: string;
};

export function DemandNoticeView({ survey, surveyId, backHref = `/qc/${surveyId}/report` }: DemandNoticeViewProps) {
  const ready = useConvexAuthReady();
  const { printNotice } = useDemandNoticePrintFit();
  const noticeProps = useConvexQuery(
    api.demandNotices.getNoticeForSurvey,
    ready ? { surveyId: surveyId as Id<"surveys"> } : "skip",
  ) as DemandNoticeDocumentProps | null | undefined;

  const propertyId = noticeProps?.propertyId ?? survey.propertyId ?? survey.parcelNo;

  if (noticeProps === undefined) {
    return (
      <PageTransition
        className={`demand-notice ${notoDevanagari.variable} ${geist.variable} bg-slate-50 ${jetbrainsMono.variable}`}
      >
        <div className="print-hidden sticky top-4 z-40 mx-auto flex w-full max-w-480 flex-col gap-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" size="sm" className="w-fit cursor-pointer rounded-xl">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to QC Report
            </Link>
          </Button>
        </div>
        <div className="mx-auto w-full max-w-480 space-y-4 rounded-2xl border border-zinc-200 bg-white p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="grid gap-3 pt-4 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <p className="text-center text-sm text-muted-foreground">Loading demand notice from server…</p>
        </div>
      </PageTransition>
    );
  }

  if (!noticeProps) {
    const notApproved = survey.qcStatus !== "approved";
    return (
      <PageTransition
        className={`demand-notice ${notoDevanagari.variable} ${geist.variable} bg-slate-50 ${jetbrainsMono.variable}`}
      >
        <div className="mx-auto w-full max-w-480 rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {notApproved
              ? "QC approval is required before generating a demand notice for this property."
              : "Demand notice data could not be loaded for this property."}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={backHref}>Back</Link>
          </Button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition
      className={`demand-notice ${notoDevanagari.variable} ${geist.variable} bg-slate-50 ${jetbrainsMono.variable}`}
    >
      <div className="print-hidden sticky top-4 z-40 mx-auto flex w-full max-w-480 flex-col gap-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" size="sm" className="w-fit cursor-pointer rounded-xl">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to QC Report
          </Link>
        </Button>
        <div className="min-w-0 flex-1 text-center sm:px-2">
          <p className="truncate text-sm font-semibold text-zinc-900">Property Tax Demand Notice</p>
          <p className="truncate font-mono text-xs text-zinc-500">{propertyId}</p>
        </div>
        <div className="flex flex-col items-end gap-1 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-fit cursor-pointer rounded-xl"
            onClick={() => void printNotice()}
          >
            <Printer className="h-4 w-4" aria-hidden /> Print Notice
          </Button>
          <p className="max-w-56 text-right text-[10px] leading-snug text-zinc-500">
            Use A4, scale 100%, minimum margins, headers off.
          </p>
        </div>
      </div>

      <div className="demand-notice-canvas demand-notice-fullpage mx-auto w-full max-w-480 px-6 pb-8 print:max-w-none print:px-0">
        <DemandNoticeDocument {...noticeProps} />
      </div>
    </PageTransition>
  );
}
