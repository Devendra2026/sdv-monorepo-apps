"use client";

import { ExecutiveHero } from "@/components/design-system/executive-hero";
import { FadeIn, PageTransition } from "@/components/design-system/motion";
import {
  QcReportKpiStrip,
  QcReportMainColumn,
  QcReportSidebar,
  ShieldCheck,
} from "@/components/qc/qc-final-report-sections";
import { Button } from "@/components/ui/button";
import { useMasters } from "@/hooks/masters/useMasters";
import { getQcReportDemand } from "@/lib/qc/qc-report-demand";
import { reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { surveyAreaMetrics } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import type { SurveyDetail } from "@/schema/surveys/index";
import { ArrowLeft, ChevronRight, Download, FileText, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

async function shareQcReport() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Report link copied to clipboard");
  } catch {
    toast.error("Could not copy link");
  }
}

type QcFinalReportViewProps = {
  survey: SurveyDetail;
  surveyId: string;
  backHref?: string;
};

export function QcFinalReportView({ survey, surveyId, backHref = `/qc/${surveyId}` }: QcFinalReportViewProps) {
  const { masters } = useMasters();
  const ulbCodes = buildUlbCodeMap(masters?.ulbs);
  const propertyId = resolveDisplayPropertyId(survey, ulbCodes) ?? survey.propertyId ?? survey.parcelNo;
  const ownerName = survey.respondentName || survey.owners?.[0]?.name || "—";
  const areas = surveyAreaMetrics({
    plotSqft: survey.plotSqft,
    plinthSqft: survey.plinthSqft,
    floors: survey.floors,
  });
  const propertyTypeOptions = survey.propertyUse ? masters?.propertyUseSubcategories?.[survey.propertyUse] : undefined;
  const propertyType =
    labelFromOptions(propertyTypeOptions, survey.propertyType) ||
    labelFromOptions(masters?.propertyUses, survey.propertyUse) ||
    "—";
  const taxZone = labelFromOptions(masters?.taxRateZones, survey.taxRateZone);
  const roadType = labelFromOptions(masters?.roadTypes, survey.roadType);
  const ownershipType = labelFromOptions(masters?.ownershipTypes, survey.ownershipType);
  const demand = getQcReportDemand(survey, survey.floors, masters ?? undefined);
  const displayAssessableSqft = demand.assessableSqft > 0 ? demand.assessableSqft : areas.builtUpSqft;
  const certifiedAt = reportDocumentTimestamp();
  const assessmentYear = survey.assessmentYear || "—";
  const frontPhoto = survey.photos?.find((p) => p.slot === "front")?.url;
  const sidePhoto = survey.photos?.find((p) => p.slot === "side")?.url;

  const pdfOptions = {
    masters: masters
      ? {
          propertyUses: masters.propertyUses,
          propertyUseSubcategories: masters.propertyUseSubcategories,
          roadTypes: masters.roadTypes,
          taxRateZones: masters.taxRateZones,
          floors: masters.floors,
          usageTypes: masters.usageTypes,
          usageFactors: masters.usageFactors,
          constructionTypes: masters.constructionTypes,
        }
      : undefined,
  };

  return (
    <PageTransition className="qc-final-report space-y-6 lg:space-y-8">
      <div className="print-hidden flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" size="sm" className="w-fit cursor-pointer rounded-xl">
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to QC Review
          </Link>
        </Button>
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/qc" className="cursor-pointer font-medium transition-colors duration-200 hover:text-foreground">
            QC Workflow
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium">Final Report</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono text-xs font-semibold text-foreground">{propertyId}</span>
        </nav>
      </div>

      <FadeIn>
        <ExecutiveHero
          eyebrow="Verified Assessment Document"
          title="QC Final Report"
          description={`Property ${propertyId} · ${ownerName} · Ward ${survey.wardNo ?? "—"}, ${survey.city ?? "—"}`}
          icon={ShieldCheck}
          gradient="brand"
          actions={
            <div className="print-hidden flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="cursor-pointer rounded-xl" onClick={shareQcReport}>
                <Share2 className="h-4 w-4" aria-hidden /> Share
              </Button>
              <Button variant="outline" size="sm" className="cursor-pointer rounded-xl" onClick={() => window.print()}>
                <Printer className="h-4 w-4" aria-hidden /> Print
              </Button>
              <Button asChild variant="outline" size="sm" className="cursor-pointer rounded-xl">
                <Link href={`/qc/${surveyId}/demand-notice`}>
                  <FileText className="h-4 w-4" aria-hidden /> Demand Notice
                </Link>
              </Button>
              <Button
                size="sm"
                className="btn-brand cursor-pointer rounded-xl"
                onClick={async () => {
                  const { generateQcFinalReportPdf } = await import("@/components/reports/queries/pdf");
                  generateQcFinalReportPdf(survey, pdfOptions);
                }}
              >
                <Download className="h-4 w-4" aria-hidden /> Download PDF
              </Button>
            </div>
          }
        />
      </FadeIn>

      <QcReportKpiStrip
        demand={demand}
        displayAssessableSqft={displayAssessableSqft}
        areas={areas}
        certifiedAt={certifiedAt}
        assessmentYear={assessmentYear}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <QcReportMainColumn
          survey={survey}
          propertyId={propertyId}
          ownerName={ownerName}
          propertyType={propertyType}
          ownershipType={ownershipType}
          taxZone={taxZone}
          roadType={roadType}
          assessmentYear={assessmentYear}
          displayAssessableSqft={displayAssessableSqft}
          masters={masters ?? undefined}
          frontPhoto={frontPhoto}
          sidePhoto={sidePhoto}
        />
        <QcReportSidebar survey={survey} surveyId={surveyId} demand={demand} certifiedAt={certifiedAt} />
      </div>
    </PageTransition>
  );
}
