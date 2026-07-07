"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { QcRemarksThread } from "@/components/qc/qc-remarks-thread";
import { RoleGate } from "@/components/shared/role-gate";
import { GpsEditPanel } from "@/components/surveys/gps-edit-panel";
import { PropertyIdTableCell, PropertyIdTableHead } from "@/components/surveys/property-id-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLog } from "@/hooks/audit/useAudit";
import { useMasters } from "@/hooks/masters/useMasters";
import { SURVEY_STATUS_LABEL, type PhotoSlot } from "@/lib/domain";
import { formatAreaSqMeter, surveyAreaMetrics } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import { surveyCompletionPercent } from "@/lib/survey/progress";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import { fmtDate } from "@/lib/utils";
import type { QcRemarkWithAuthor } from "@/schema/qc/index";
import type { FloorRow, OwnerEntry, SurveyDetail } from "@/schema/surveys/index";
import {
  Building2,
  Camera,
  ClipboardList,
  ImageOff,
  Layers,
  MapPin,
  MapPinHouse,
  MessageSquare,
  Receipt,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";

const PHOTO_LABEL: Record<"front" | "side", string> = {
  front: "Front View",
  side: "Side View",
};

const DETAIL_PHOTO_SLOT_ORDER = ["front", "side"] as const satisfies readonly PhotoSlot[];

const AREA_METRIC_CARD_STYLES = {
  navy: "border-brand-navy/25 bg-brand-navy/6 text-brand-navy dark:border-primary/30 dark:bg-primary/10 dark:text-primary-foreground",
  muted: "border-border/60 bg-muted/40 text-foreground dark:bg-muted/20",
  success: "border-success/30 bg-success/10 text-emerald-800 dark:text-emerald-300",
} as const;

function SectionCard({
  title,
  description,
  children,
  className,
  icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <GlassCard padding="md" className={className}>
      <GlassCardHeader title={title} description={description} icon={icon} />
      {children}
    </GlassCard>
  );
}

/* ─── Field card ────────────────────────────────────────────────── */
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value == null || value === "" || value === "—";
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 px-3 py-2.5 shadow-premium-sm backdrop-blur-sm dark:bg-card/40">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p
        className={`text-sm font-medium leading-snug ${empty ? "italic text-muted-foreground/40" : "text-foreground"}`}
      >
        {empty ? "—" : value}
      </p>
    </div>
  );
}

/* ─── Field grid ────────────────────────────────────────────────── */
function FieldGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  const cls =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return <div className={`grid gap-3 ${cls}`}>{children}</div>;
}

/* ─── Area summary grid ─────────────────────────────────────────── */
function AreaMetricCard({
  label,
  sqft,
  sqm,
  color,
}: {
  label: string;
  sqft: number;
  sqm: string;
  color: keyof typeof AREA_METRIC_CARD_STYLES;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-premium-sm ${AREA_METRIC_CARD_STYLES[color]}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="mt-1.5 text-xl font-black tabular-nums leading-none">
        {sqft > 0 ? sqft.toLocaleString("en-IN") : "—"}
      </p>
      <p className="mt-0.5 text-xs opacity-60">{sqft > 0 ? sqm : "—"}</p>
    </div>
  );
}

function AreaSummaryGrid({ survey }: { survey: SurveyDetail }) {
  const areas = surveyAreaMetrics({ plotSqft: survey.plotSqft, plinthSqft: survey.plinthSqft, floors: survey.floors });
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <AreaMetricCard label="Plot Area" sqft={areas.plotSqft} sqm={formatAreaSqMeter(areas.plotSqft)} color="navy" />
      <AreaMetricCard
        label="Plinth Area"
        sqft={areas.plinthSqft}
        sqm={formatAreaSqMeter(areas.plinthSqft)}
        color="muted"
      />
      <AreaMetricCard
        label="Built-up Area"
        sqft={areas.builtUpSqft}
        sqm={formatAreaSqMeter(areas.builtUpSqft)}
        color="success"
      />
    </div>
  );
}

/* ─── Floors table ──────────────────────────────────────────────── */
function FloorsTable({ floors, masters }: { floors: FloorRow[]; masters: any }) {
  const areas = surveyAreaMetrics({ plotSqft: 0, plinthSqft: 0, floors });
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-brand-navy/10 bg-linear-to-r from-brand-navy/6 via-muted/25 to-brand-navy/4 hover:from-brand-navy/6 dark:border-primary/15 dark:from-primary/12 dark:via-muted/10 dark:to-primary/6">
              <TableHead className="w-14 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                S. No
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Floor
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Usage type
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Usage factor
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Construction
              </TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Area
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {floors.map((f, i) => (
              <TableRow
                key={f._id}
                className={`border-b border-border/40 last:border-b-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/20 dark:bg-muted/10"}`}
              >
                <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium capitalize">
                  {labelFromOptions(masters?.floors, f.floorName)}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {labelFromOptions(masters?.usageTypes, f.usageType) || "—"}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {labelFromOptions(masters?.usageFactors, f.usageFactor) || "—"}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {labelFromOptions(masters?.constructionTypes, f.constructionType)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {f.areaSqft.toLocaleString("en-IN")} Sqft
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-brand-navy/15 bg-brand-navy/5 px-4 py-2.5 dark:border-primary/20 dark:bg-primary/10">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Total Built-up Area</span>
        <span className="font-mono text-sm font-bold text-brand-navy dark:text-primary-foreground">
          {areas.builtUpSqft > 0
            ? `${areas.builtUpSqft.toLocaleString("en-IN")} Sqft · ${formatAreaSqMeter(areas.builtUpSqft)}`
            : "—"}
        </span>
      </div>
    </div>
  );
}

/* ─── Audit table ───────────────────────────────────────────────── */
function AuditTable({ audit, propertyId }: { audit: any[]; propertyId?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/60 bg-muted/40 hover:bg-muted/40 dark:bg-muted/20">
            <PropertyIdTableHead />
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              When
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Action
            </TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Actor
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audit.map((a, i) => (
            <TableRow
              key={a._id}
              className={`border-b border-border/40 last:border-b-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
            >
              <PropertyIdTableCell propertyId={propertyId} />
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {fmtDate(a._creationTime)}
              </TableCell>
              <TableCell>
                <span className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs dark:bg-muted/30">
                  {a.action}
                </span>
              </TableCell>
              <TableCell className="font-medium">{a.actor?.name ?? "System"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Photo slots ───────────────────────────────────────────────── */
function DetailPhotoSlots({ photos, uploaderName }: { photos: SurveyDetail["photos"]; uploaderName?: string }) {
  const uploadedCount = DETAIL_PHOTO_SLOT_ORDER.filter((s) => photos.find((p) => p.slot === s)?.url).length;
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Photos uploaded</p>
            <span className="text-xs font-bold text-brand-navy dark:text-primary">
              {uploadedCount}/{DETAIL_PHOTO_SLOT_ORDER.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-navy to-brand-red transition-all duration-300"
              style={{ width: `${(uploadedCount / DETAIL_PHOTO_SLOT_ORDER.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {DETAIL_PHOTO_SLOT_ORDER.map((slot) => {
          const photo = photos.find((p) => p.slot === slot);
          const required = slot === "front" || slot === "side";
          return (
            <div
              key={slot}
              className={`premium-card group flex flex-col overflow-hidden rounded-xl shadow-premium-sm transition-all duration-200 hover:shadow-premium-md ${
                photo?.url
                  ? "border-brand-navy/20 dark:border-primary/25"
                  : required
                    ? "border-dashed border-warning/50 dark:border-warning/40"
                    : "border-dashed border-border/50"
              }`}
            >
              <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/50">
                {photo?.url ? (
                  <Image
                    src={photo.url}
                    alt={PHOTO_LABEL[slot]}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-8 w-8 opacity-25" />
                    <p className="text-[11px] font-medium opacity-50">No photo</p>
                  </div>
                )}
                {/* Required badge */}
                {required && !photo?.url && (
                  <div className="absolute right-2 top-2">
                    <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm">
                      Required
                    </span>
                  </div>
                )}
                {/* Uploaded badge */}
                {photo?.url && (
                  <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                      View
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-border/40 bg-background/60 px-3 py-2 dark:bg-card/60">
                <p className="text-xs font-semibold text-foreground">{PHOTO_LABEL[slot]}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {photo ? `${fmtDate(photo.capturedAt)}${uploaderName ? ` · ${uploaderName}` : ""}` : "Not uploaded"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Variant config ────────────────────────────────────────────── */
const SURVEY_DETAIL_VARIANTS = {
  "survey-view": {
    showProgressFooter: true,
    showQcRemarks: true,
    showStatusInBody: false,
  },
  "qc-review": {
    showProgressFooter: false,
    showQcRemarks: false,
    showStatusInBody: true,
  },
} as const;

type SurveyDetailVariant = keyof typeof SURVEY_DETAIL_VARIANTS;

type SurveyDetailViewCoreProps = {
  survey: SurveyDetail;
  surveyId: string;
  remarks?: QcRemarkWithAuthor[];
  variant: SurveyDetailVariant;
};

function SurveyDetailViewCore({ survey, surveyId, remarks, variant }: SurveyDetailViewCoreProps) {
  const { showProgressFooter, showQcRemarks, showStatusInBody } = SURVEY_DETAIL_VARIANTS[variant];
  const { masters } = useMasters();
  const audit = useAuditLog({ entity: "survey", entityId: surveyId, limit: 100 });
  const ulbCodes = buildUlbCodeMap(masters?.ulbs);
  const propertyId = resolveDisplayPropertyId(survey, ulbCodes) ?? survey.propertyId;
  const owners: OwnerEntry[] = survey.owners ?? [];
  const ulb = masters?.ulbs?.find((m: { _id: string }) => m._id === survey.municipalityId);
  const district = masters?.districts?.find(
    (d: { _id: string }) => d._id === (survey as { districtId?: string }).districtId,
  );
  const progress = surveyCompletionPercent(survey);
  const propertyTypeOptions = survey.propertyUse ? masters?.propertyUseSubcategories?.[survey.propertyUse] : undefined;

  return (
    <div className="space-y-4">
      {/* ── Property Identification ────────────────────────────── */}
      <SectionCard
        title="Property Identification"
        description="ULB, ward, parcel and generated Property ID."
        icon={<Building2 className="h-4 w-4" aria-hidden />}
      >
        <FieldGrid cols={4}>
          <DetailField label="ULB / Local Body" value={ulb?.name ?? survey.city} />
          <DetailField label="Ward Number" value={survey.wardNo} />
          <DetailField label="Sector / Zone" value={survey.sectorNo} />
          <DetailField label="Parcel Number" value={survey.parcelNo} />
          <DetailField label="Unit / Sub-No" value={survey.unitNo} />
          <DetailField label="Property ID (Old)" value={survey.oldPropertyNo} />
          <DetailField label="Constructed Year" value={survey.constructedYear} />
          <DetailField label="District" value={district?.name} />
          {showStatusInBody && <DetailField label="Survey Status" value={SURVEY_STATUS_LABEL[survey.status]} />}
          <DetailField label="Surveyor" value={survey.surveyor?.name} />
          <DetailField label="Slum Area" value={survey.isSlum ? "Yes — notified slum" : "No"} />
        </FieldGrid>
      </SectionCard>

      {/* ── Owner & Household ─────────────────────────────────── */}
      <SectionCard
        title="Owner & Household"
        description="Respondent and co-owners from the mobile survey."
        icon={<Users className="h-4 w-4" aria-hidden />}
      >
        <FieldGrid>
          <DetailField label="Respondent Name" value={survey.respondentName} />
          <DetailField
            label="Mobile Number"
            value={survey.mobileNo ? `+91 ${survey.mobileNo.replace(/^\+?91/, "")}` : undefined}
          />
          <DetailField label="Family Size" value={survey.familySize} />
          <DetailField
            label="Relationship w/ Owner"
            value={labelFromOptions(masters?.relationships, survey.relationship)}
          />
          <DetailField label="Alt Mobile" value={survey.altMobileNo} />
          <DetailField label="Father / Husband Name" value={owners[0]?.fatherOrHusbandName} />
        </FieldGrid>
        {owners.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-brand-navy/10 bg-linear-to-r from-brand-navy/6 via-muted/25 to-brand-navy/4 hover:from-brand-navy/6 dark:border-primary/15 dark:from-primary/12 dark:via-muted/10 dark:to-primary/6">
                  <PropertyIdTableHead />
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Father / Husband
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Mobile
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Alt Mobile
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((o) => (
                  <TableRow
                    key={`${o.name}-${o.mobileNo}-${o.fatherOrHusbandName}`}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <PropertyIdTableCell propertyId={propertyId} />
                    <TableCell className="font-medium">{o.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{o.fatherOrHusbandName || "—"}</TableCell>
                    <TableCell className="tabular-nums">{o.mobileNo || "—"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{o.altMobileNo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* ── Address + GIS ─────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Address" icon={<MapPinHouse className="h-4 w-4" aria-hidden />} className="h-full">
          <FieldGrid cols={2}>
            <DetailField label="House / Door No" value={survey.houseNo} />
            <DetailField label="Colony / Society" value={survey.colonyName} />
            <DetailField label="Locality / Landmark" value={survey.locality} />
            <DetailField label="City" value={survey.city} />
            <DetailField label="Pin Code" value={survey.pinCode} />
          </FieldGrid>
        </SectionCard>

        <SectionCard
          title="GIS Mapping"
          description="Property GPS coordinates. Edit on the survey edit page."
          icon={<MapPin className="h-4 w-4" aria-hidden />}
          className="h-full"
        >
          <GpsEditPanel surveyId={surveyId} gps={survey.gps} canEdit={false} />
        </SectionCard>
      </div>

      {/* ── Taxation & Usage ──────────────────────────────────── */}
      <SectionCard title="Taxation & Usage" icon={<Receipt className="h-4 w-4" aria-hidden />}>
        <FieldGrid>
          <DetailField label="Assessment Year" value={survey.assessmentYear} />
          <DetailField label="Ownership Type" value={labelFromOptions(masters?.ownershipTypes, survey.ownershipType)} />
          <DetailField label="Property Use" value={labelFromOptions(masters?.propertyUses, survey.propertyUse)} />
          <DetailField label="Property Type" value={labelFromOptions(propertyTypeOptions, survey.propertyType)} />
          <DetailField label="Situation" value={labelFromOptions(masters?.situations, survey.situation)} />
          <DetailField label="Road Type" value={labelFromOptions(masters?.roadTypes, survey.roadType)} />
          <DetailField label="Tax Rate Zone" value={labelFromOptions(masters?.taxRateZones, survey.taxRateZone)} />
        </FieldGrid>
      </SectionCard>

      {/* ── Floor Details ─────────────────────────────────────── */}
      <SectionCard
        title="Floor Details"
        description="Plot, plinth and built-up areas plus per-floor breakdown."
        icon={<Layers className="h-4 w-4" aria-hidden />}
      >
        <div className="space-y-4">
          <AreaSummaryGrid survey={survey} />
          {survey.floors?.length ? (
            <FloorsTable floors={survey.floors} masters={masters} />
          ) : (
            <p className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No floor records
            </p>
          )}
        </div>
      </SectionCard>

      {/* ── Municipal Services ────────────────────────────────── */}
      <SectionCard title="Municipal Services" icon={<Zap className="h-4 w-4" aria-hidden />}>
        <FieldGrid cols={2}>
          <DetailField label="Water Connection" value={survey.municipalWaterConnection ? "Yes" : "No"} />
          <DetailField label="Source of Water" value={labelFromOptions(masters?.waterSources, survey.waterSource)} />
          <DetailField
            label="Sanitation Type"
            value={labelFromOptions(masters?.sanitationTypes, survey.sanitationType)}
          />
          <DetailField label="Door-to-door Collection" value={survey.municipalWasteCollection ? "Yes" : "No"} />
          <DetailField label="Electricity Consumer No" value={survey.electricityNo} />
        </FieldGrid>
      </SectionCard>

      {/* ── Photo Documentation ───────────────────────────────── */}
      <SectionCard
        title="Photo Documentation"
        description="Front and side property photos captured during the survey."
        icon={<Camera className="h-4 w-4" aria-hidden />}
      >
        <DetailPhotoSlots photos={survey.photos ?? []} uploaderName={survey.surveyor?.name} />
      </SectionCard>

      {/* ── QC Remarks ─────────────────────────────────────────── */}
      {showQcRemarks && (remarks === undefined || remarks.length > 0) && (
        <SectionCard
          title="QC Remarks & Corrections"
          description="Feedback from supervisors during quality control review."
          icon={<MessageSquare className="h-4 w-4" aria-hidden />}
        >
          <QcRemarksThread remarks={remarks} />
        </SectionCard>
      )}

      {/* ── Audit History ─────────────────────────────────────── */}
      <SectionCard title="Audit History" icon={<ClipboardList className="h-4 w-4" aria-hidden />}>
        <RoleGate capability="audit.view" deniedDescription="Audit history is visible to administrators only.">
          {audit === undefined ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : audit.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No audit entries
            </p>
          ) : (
            <AuditTable audit={audit} propertyId={propertyId} />
          )}
        </RoleGate>
      </SectionCard>

      {/* ── Sticky progress footer ────────────────────────────── */}
      {showProgressFooter && (
        <div className="premium-card sticky bottom-0 z-10 overflow-hidden rounded-2xl border border-brand-navy/15 bg-card/95 shadow-premium-lg backdrop-blur-md dark:border-primary/20">
          <div className="h-1 w-full bg-muted">
            <div
              className="h-full bg-linear-to-r from-brand-navy to-brand-red transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white shadow-premium-sm dark:bg-primary">
                {progress}
              </div>
              <div>
                <p className="font-heading text-xs font-bold text-brand-navy dark:text-primary">Survey Completion</p>
                <p className="text-[11px] text-muted-foreground">{progress}% of all fields filled</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <p className="text-[11px] text-muted-foreground">
                Updated {fmtDate((survey as { clientUpdatedAt?: number }).clientUpdatedAt ?? survey._creationTime)}
              </p>
              {survey.submittedAt && (
                <p className="text-[11px] font-semibold text-primary/80">Submitted {fmtDate(survey.submittedAt)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only survey detail for QC review — no progress footer or QC remarks thread. */
export function QcReviewDetailView({ survey, surveyId }: { survey: SurveyDetail; surveyId: string }) {
  return <SurveyDetailViewCore survey={survey} surveyId={surveyId} variant="qc-review" />;
}

/** Survey detail page — read-only; use `/surveys/[id]/edit` for CRUD. */
export function SurveyPageDetailView({
  survey,
  surveyId,
  remarks,
}: {
  survey: SurveyDetail;
  surveyId: string;
  remarks?: QcRemarkWithAuthor[];
}) {
  return <SurveyDetailViewCore survey={survey} surveyId={surveyId} remarks={remarks} variant="survey-view" />;
}
