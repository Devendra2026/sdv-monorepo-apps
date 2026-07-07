"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { DemandRegisterRow } from "@/hooks/qc/useDemandNoticePanel";
import { useSurvey } from "@/hooks/surveys/useSurveys";
import { buildSurveyAddress } from "@/lib/qc/demand-notice";
import { formatAreaSqft } from "@/lib/survey/area";
import { ExternalLink, Printer } from "lucide-react";

export function DemandNoticePreviewSheet({
  row,
  open,
  onOpenChange,
}: {
  row: DemandRegisterRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const survey = useSurvey(open && row ? row.surveyId : undefined);
  const href = row ? `/reports/demand-notices/${row.surveyId}` : "#";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Demand Notice Preview</SheetTitle>
          <SheetDescription>Full survey assessment loaded for this QC-approved property.</SheetDescription>
        </SheetHeader>
        {row ? (
          <div className="space-y-3 px-4 text-sm">
            <div className="rounded-lg border border-border/70 p-3">
              <p className="font-semibold">{row.propertyId}</p>
              <p className="text-muted-foreground">{row.ownerName}</p>
            </div>
            {survey === undefined ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : survey === null ? (
              <p className="text-destructive">Survey data could not be loaded.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-muted-foreground">Ward</dt>
                    <dd className="font-medium">{row.wardNo}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Parcel</dt>
                    <dd className="font-medium">{row.parcelNo}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Assessable Area</dt>
                    <dd className="font-medium">{formatAreaSqft(row.assessableSqft)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Annual Demand</dt>
                    <dd className="font-semibold">{row.annualDemandLabel}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="font-medium">{buildSurveyAddress(survey) || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Floors</dt>
                    <dd className="font-medium">{(survey.floors ?? []).length}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Assessment Year</dt>
                    <dd className="font-medium">{survey.assessmentYear || "—"}</dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        ) : null}
        <SheetFooter className="border-t border-border/70">
          <Button asChild variant="outline" disabled={!row}>
            <a href={href} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Open Notice
            </a>
          </Button>
          <Button asChild disabled={!row}>
            <a href={href} target="_blank" rel="noreferrer">
              <Printer className="mr-2 h-4 w-4" /> Print Notice
            </a>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
