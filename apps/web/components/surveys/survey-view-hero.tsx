"use client";

import { RoleGate } from "@/components/shared/role-gate";
import { QcStatusBadge, SurveyStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useMasters } from "@/hooks/masters/useMasters";
import { QC_TABLE } from "@/lib/design-system";
import { formatRegistryParcelNo } from "@/lib/survey/format-registry-parcel";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import { resolveOwnerDisplayName } from "@/lib/survey/resolve-owner-name";
import { cn } from "@/lib/utils";
import type { SurveyDetail, SurveyListItem } from "@/schema/surveys/index";
import { Pencil, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function HeaderField({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  const empty = value == null || value === "" || value === "—";
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <p className={QC_TABLE.sectionLabel}>{label}</p>
      <p
        className={cn(
          "truncate text-sm font-semibold text-foreground",
          mono && "font-mono tabular-nums",
          empty && "italic font-normal text-muted-foreground/45",
        )}
      >
        {empty ? "—" : value}
      </p>
    </div>
  );
}

export function SurveyViewHero({
  survey,
  surveyId,
  canEdit,
  onDelete,
  title = "Survey View",
  icon: Icon,
  extraActions,
  showStatus = false,
  className,
}: {
  survey: Pick<
    SurveyListItem,
    | "propertyId"
    | "municipalityId"
    | "wardNo"
    | "parcelNo"
    | "propertyUse"
    | "status"
    | "qcStatus"
    | "owners"
    | "respondentName"
    | "city"
  > & { surveyor?: SurveyDetail["surveyor"] };
  surveyId: string;
  canEdit: boolean;
  onDelete?: () => void;
  title?: string;
  icon?: LucideIcon;
  extraActions?: ReactNode;
  /** Survey + QC status badges — enabled on `/surveys/[id]` header only. */
  showStatus?: boolean;
  className?: string;
}) {
  const { masters } = useMasters();
  const ulbCodes = buildUlbCodeMap(masters?.ulbs);
  const propertyId = resolveDisplayPropertyId(survey, ulbCodes) ?? survey.propertyId ?? `Parcel ${survey.parcelNo}`;
  const ulb = masters?.ulbs?.find((m: { _id: string }) => m._id === survey.municipalityId);
  const ulbName = ulb?.name ?? survey.city;
  const ownerName = resolveOwnerDisplayName(survey);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium-sm dark:bg-card/90",
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy dark:bg-primary/15 dark:text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
          )}
          <h1 className="font-heading text-sm font-bold uppercase tracking-[0.14em] text-brand-navy dark:text-primary">
            {title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          <RoleGate capability="surveys.editDraft" fallback={null}>
            {canEdit && (
              <Button
                asChild
                size="sm"
                className={
                  survey.qcStatus === "rejected"
                    ? "btn-brand cursor-pointer rounded-lg shadow-sm transition-colors duration-200"
                    : "cursor-pointer rounded-lg bg-brand-navy text-white shadow-sm transition-colors duration-200 hover:bg-brand-navy/90 dark:bg-primary dark:hover:bg-primary/90"
                }
              >
                <Link href={`/surveys/${surveyId}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  {survey.qcStatus === "rejected" ? "Fix & Re-submit" : "Edit"}
                </Link>
              </Button>
            )}
          </RoleGate>
          {onDelete && (
            <RoleGate capability="surveys.delete" fallback={null}>
              {survey.qcStatus !== "approved" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="cursor-pointer rounded-lg border-brand-red/35 text-brand-red transition-colors duration-200 hover:bg-brand-red/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </Button>
              )}
            </RoleGate>
          )}
        </div>
      </div>

      <div className={cn("grid gap-4 px-4 py-4 sm:px-5", showStatus && "lg:grid-cols-[1fr_auto] lg:items-end")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 xl:grid-cols-5">
          <HeaderField label="Property ID" value={propertyId} mono className="sm:col-span-2 xl:col-span-1" />
          <HeaderField label="ULB Name" value={ulbName} className="sm:col-span-2 xl:col-span-1" />
          <HeaderField label="Ward No" value={survey.wardNo} mono />
          <HeaderField label="Parcel No" value={formatRegistryParcelNo(survey.parcelNo)} mono />
          <HeaderField label="Owner Name" value={ownerName} />
        </div>

        {showStatus && (
          <div className="flex min-w-0 flex-col gap-1.5 lg:items-end lg:pb-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Status</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <SurveyStatusBadge status={survey.status} />
              <QcStatusBadge status={survey.qcStatus} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
