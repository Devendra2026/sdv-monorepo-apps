"use client";

import { SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { GoogleMapEmbed } from "@/components/shared/google-map-embed";
import { QcStatusBadge, SurveyStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { api } from "@/convex/_generated/api";
import { formatInr, type DemandAssessment } from "@/lib/qc/demand-estimate";
import { formatAreaSqft, formatAreaSqMeter, type SurveyAreaMetrics } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import { fmtDate } from "@/lib/utils";
import type { SurveyDetail } from "@/schema/surveys/index";
import type { FunctionReturnType } from "convex/server";
import {
  BadgeCheck,
  Building2,
  Camera,
  FileText,
  ImageOff,
  Layers,
  MapPin,
  MapPinHouse,
  Receipt,
  Ruler,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "" || value === "—";
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 px-3 py-2.5 shadow-premium-sm backdrop-blur-sm dark:bg-card/40">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-medium leading-snug ${empty ? "italic text-muted-foreground/50" : "text-foreground"}`}
      >
        {empty ? "—" : value}
      </p>
    </div>
  );
}

function ReportPhoto({ url, label }: { url?: string | null; label: string }) {
  return (
    <figure className="premium-card overflow-hidden rounded-xl border border-border/60">
      <div className="relative aspect-4/3 bg-muted/40">
        {url ? (
          <Image
            src={url}
            alt={label}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-7 w-7 opacity-40" aria-hidden />
            <p className="text-xs font-medium opacity-60">No {label.toLowerCase()}</p>
          </div>
        )}
      </div>
      <figcaption className="border-t border-border/50 px-3 py-2 text-center text-xs font-semibold text-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

type MastersBundle = NonNullable<FunctionReturnType<typeof api.masters.bundle>>;
type ReportDemand = DemandAssessment & { assessableSqft: number };

export function QcReportKpiStrip({
  demand,
  displayAssessableSqft,
  areas,
  certifiedAt,
  assessmentYear,
}: {
  demand: ReportDemand;
  displayAssessableSqft: number;
  areas: SurveyAreaMetrics;
  certifiedAt: number;
  assessmentYear: string;
}) {
  return (
    <section aria-labelledby="report-kpi-heading">
      <SectionHeader
        id="report-kpi-heading"
        title="Assessment Summary"
        description="Key figures from the finalized QC record"
        className="mb-4"
      />
      <StaggerGrid className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        <StaggerItem>
          <MetricCard
            label="Annual Demand"
            value={demand.total > 0 ? formatInr(demand.total) : "—"}
            hint="estimated property tax"
            icon={Receipt}
            tone="ai"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Assessable Area"
            value={displayAssessableSqft > 0 ? formatAreaSqft(displayAssessableSqft) : "—"}
            hint={formatAreaSqMeter(displayAssessableSqft)}
            icon={Ruler}
            tone="info"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Plot Area"
            value={formatAreaSqft(areas.plotSqft)}
            hint={formatAreaSqMeter(areas.plotSqft)}
            icon={MapPinHouse}
            tone="default"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Plinth Area"
            value={formatAreaSqft(areas.plinthSqft)}
            hint={formatAreaSqMeter(areas.plinthSqft)}
            icon={Building2}
            tone="muted"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Certified On"
            value={fmtDate(certifiedAt)}
            hint={`Year ${assessmentYear}`}
            icon={BadgeCheck}
            tone="success"
          />
        </StaggerItem>
      </StaggerGrid>
    </section>
  );
}

export function QcReportMainColumn({
  survey,
  propertyId,
  ownerName,
  propertyType,
  ownershipType,
  taxZone,
  roadType,
  assessmentYear,
  displayAssessableSqft,
  masters,
  frontPhoto,
  sidePhoto,
}: {
  survey: SurveyDetail;
  propertyId: string;
  ownerName: string;
  propertyType: string;
  ownershipType: string;
  taxZone: string;
  roadType: string;
  assessmentYear: string;
  displayAssessableSqft: number;
  masters?: Pick<MastersBundle, "floors" | "usageTypes" | "usageFactors" | "constructionTypes">;
  frontPhoto?: string | null;
  sidePhoto?: string | null;
}) {
  return (
    <div className="space-y-6">
      <FadeIn delay={0.04}>
        <GlassCard padding="md">
          <GlassCardHeader
            title="Property & Owner"
            description="Identity and taxation attributes"
            icon={<Users className="h-4 w-4" aria-hidden />}
            className="mb-4"
          />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <QcStatusBadge status={survey.qcStatus} />
            <SurveyStatusBadge status={survey.status} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Property ID" value={<span className="font-mono text-xs">{propertyId}</span>} />
            <DetailField label="Owner / Respondent" value={ownerName} />
            <DetailField label="Ward" value={survey.wardNo ? `Ward ${survey.wardNo}` : "—"} />
            <DetailField label="ULB / City" value={survey.city ?? "—"} />
            <DetailField label="Property Type" value={propertyType} />
            <DetailField label="Ownership" value={ownershipType} />
            <DetailField label="Tax Rate Zone" value={taxZone} />
            <DetailField label="Road Type" value={roadType} />
            <DetailField label="Surveyor" value={survey.surveyor?.name ?? "—"} />
            <DetailField label="Parcel No" value={survey.parcelNo} />
            <DetailField label="Assessment Year" value={assessmentYear} />
            <DetailField
              label="Address"
              value={
                [survey.houseNo, survey.locality, survey.colonyName, survey.pinCode].filter(Boolean).join(", ") || "—"
              }
            />
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.06}>
        <GlassCard padding="none" className="overflow-hidden">
          <GlassCardHeader
            title="Floor-wise Area Breakdown"
            description="Measured built-up areas by level"
            icon={<Layers className="h-4 w-4" aria-hidden />}
            className="border-b border-border/50 px-5 py-4"
          />
          {survey.floors?.length ? (
            <div className="overflow-x-auto p-4 pt-0">
              <div className="premium-card overflow-hidden rounded-xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-brand-navy/10 bg-linear-to-r from-brand-navy/6 via-muted/25 to-brand-navy/4 hover:bg-brand-navy/6 dark:border-primary/15 dark:from-primary/12">
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em]">Floor</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em]">Usage</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em]">Construction</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase tracking-[0.12em]">
                        Built-up (sqft)
                      </TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-[0.12em]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {survey.floors.map((floor) => (
                      <TableRow key={floor._id} className="border-b border-border/40 text-sm">
                        <TableCell className="font-medium capitalize">
                          {labelFromOptions(masters?.floors, floor.floorName)}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {labelFromOptions(masters?.usageTypes, floor.usageType) ||
                            labelFromOptions(masters?.usageFactors, floor.usageFactor)}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {labelFromOptions(masters?.constructionTypes, floor.constructionType)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {floor.areaSqft.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                            Measured
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No floor records available</p>
          )}
          <div className="flex items-center justify-between border-t border-border/50 bg-brand-navy/5 px-5 py-4 dark:bg-primary/8">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Total Assessable Area
            </span>
            <span className="font-display text-2xl font-bold tabular-nums text-foreground">
              {displayAssessableSqft > 0
                ? `${displayAssessableSqft.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} sq ft`
                : "—"}
            </span>
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.08}>
        <GlassCard padding="md">
          <GlassCardHeader
            title="Site Documentation"
            description="Geo-tagged photographic evidence"
            icon={<Camera className="h-4 w-4" aria-hidden />}
            className="mb-4"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ReportPhoto url={frontPhoto} label="Front View" />
            <ReportPhoto url={sidePhoto} label="Side View" />
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

export function QcReportSidebar({
  survey,
  surveyId,
  demand,
  certifiedAt,
}: {
  survey: SurveyDetail;
  surveyId: string;
  demand: ReportDemand;
  certifiedAt: number;
}) {
  return (
    <aside className="space-y-5 xl:sticky xl:top-6">
      <FadeIn delay={0.06}>
        <GlassCard variant="accent" padding="md" className="border-brand-red/20">
          <GlassCardHeader
            title="Demand Assessment"
            description="Annual property tax estimate"
            icon={<Receipt className="h-4 w-4" aria-hidden />}
            className="mb-4"
          />
          {demand.lines.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {demand.lines.map((line) => (
                <li key={line.label} className="flex items-center justify-between py-3 first:pt-0">
                  <span className="text-sm text-muted-foreground">{line.label}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatInr(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No assessable area on record — add floor or plot area to calculate demand.
            </p>
          )}
          <div className="mt-4 rounded-xl border-2 border-brand-red/25 bg-brand-red/8 px-4 py-5 dark:border-brand-red/35 dark:bg-brand-red/12">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Total Annual Demand
            </p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-brand-red">
              {demand.total > 0 ? formatInr(demand.total) : "—"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full cursor-pointer rounded-xl">
            <Link href={`/qc/${surveyId}/demand-notice`}>
              <FileText className="h-4 w-4" aria-hidden /> View Demand Notice
            </Link>
          </Button>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.1}>
        {survey.gps ? (
          <GoogleMapEmbed
            latitude={survey.gps.latitude}
            longitude={survey.gps.longitude}
            accuracyMeters={survey.gps.accuracyMeters}
          />
        ) : (
          <GlassCard padding="md" className="text-center">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="mt-2 text-sm text-muted-foreground">No GPS coordinates captured</p>
          </GlassCard>
        )}
      </FadeIn>

      <FadeIn delay={0.12}>
        <GlassCard padding="md">
          <SectionHeader title="Certification Record" description="Report metadata" className="mb-4" />
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Certified On</dt>
              <dd className="mt-0.5 font-mono font-semibold text-foreground">{fmtDate(certifiedAt)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Surveyor</dt>
              <dd className="mt-0.5 font-medium text-foreground">{survey.surveyor?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">ULB</dt>
              <dd className="mt-0.5 font-medium text-foreground">{survey.city ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-xl border border-success/35 bg-success/10 px-4 py-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden />
              <p className="text-sm font-semibold">Document integrity verified</p>
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    </aside>
  );
}

export { ShieldCheck };
