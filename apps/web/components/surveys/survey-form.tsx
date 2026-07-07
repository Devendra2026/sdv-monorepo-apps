"use client";

import {
  AddressSection,
  OwnerSection,
  ServicesSection,
  TaxationSection,
  TenantPropertySection,
} from "@/components/surveys/survey-form-sections";
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters";
import { useSaveDraft } from "@/hooks/surveys/useSurveys";
import {
  applyServerFieldErrors,
  conflictSurveyHref,
  getConflictingSurveyId,
  toastSurveyConflict,
  type ConflictSurveyLinkVariant,
} from "@/lib/errors";
import { formatPropertyId } from "@/lib/survey/area";
import type { SurveyListItem } from "@/schema/surveys/index";
import { surveyDraftSchema, type SurveyDraftValues } from "@/schema/surveys/surveySchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export type SurveyFormHandle = {
  save: (patch?: Partial<SurveyDraftValues>) => Promise<boolean>;
};

type SurveyFormProps = {
  ref?: Ref<SurveyFormHandle>;
  localId: string;
  /** Server row id — required for supervisor QC corrections on web. */
  surveyId?: string;
  municipalityId?: string;
  existing?: SurveyListItem | null;
  onSaved?: (surveyId: string) => void;
  onDirty?: () => void;
  onValidationError?: () => void;
  conflictLinkVariant?: ConflictSurveyLinkVariant;
};

function buildDefaultValues(
  localId: string,
  municipalityId: string | undefined,
  existing?: SurveyListItem | null,
): SurveyDraftValues {
  const defaultOwners =
    existing?.owners && existing.owners.length > 0
      ? existing.owners.map((owner) => ({
          name: owner.name ?? "",
          fatherOrHusbandName: owner.fatherOrHusbandName ?? "",
          mobileNo: owner.mobileNo ?? "",
          altMobileNo: owner.altMobileNo ?? "",
        }))
      : [{ name: "", fatherOrHusbandName: "", mobileNo: "", altMobileNo: "" }];

  return {
    localId,
    municipalityId: existing?.municipalityId ?? municipalityId ?? "",
    clientUpdatedAt: Date.now(),
    wardNo: existing?.wardNo ?? "",
    parcelNo: existing?.parcelNo ?? "",
    unitNo: existing?.unitNo ?? "",
    sectorNo: existing?.sectorNo ?? "",
    oldPropertyNo: existing?.oldPropertyNo ?? "",
    propertyId: existing?.propertyId ?? "",
    constructedYear: existing?.constructedYear,
    isSlum: existing?.isSlum ?? false,
    respondentName: existing?.respondentName ?? "",
    relationship: existing?.relationship as SurveyDraftValues["relationship"],
    owners: defaultOwners,
    familySize: existing?.familySize,
    mobileNo: existing?.mobileNo ?? "",
    altMobileNo: existing?.altMobileNo ?? "",
    houseNo: existing?.houseNo ?? "",
    locality: existing?.locality ?? "",
    colonyName: existing?.colonyName ?? "",
    pinCode: existing?.pinCode ?? "",
    assessmentYear: existing?.assessmentYear ?? "",
    ownershipType: existing?.ownershipType ?? "",
    propertyUse: existing?.propertyUse ?? "",
    propertyType: existing?.propertyType ?? "",
    situation: existing?.situation ?? "",
    roadType: existing?.roadType ?? "",
    taxRateZone: existing?.taxRateZone ?? "",
    plotSqft: existing?.plotSqft ?? 0,
    plinthSqft: existing?.plinthSqft ?? 0,
    municipalWaterConnection: existing?.municipalWaterConnection ?? false,
    waterSource: existing?.waterSource as SurveyDraftValues["waterSource"],
    sanitationType: existing?.sanitationType as SurveyDraftValues["sanitationType"],
    municipalWasteCollection: existing?.municipalWasteCollection ?? false,
  } as SurveyDraftValues;
}

export function SurveyForm({
  ref,
  localId,
  surveyId,
  municipalityId,
  existing,
  onSaved,
  onDirty,
  onValidationError,
  conflictLinkVariant = "surveys",
}: SurveyFormProps) {
  const router = useRouter();
  const { masters } = useMasters();
  const saveDraft = useSaveDraft();
  const [conflictingSurveyId, setConflictingSurveyId] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<SurveyDraftValues>({
    resolver: zodResolver(surveyDraftSchema),
    defaultValues: buildDefaultValues(localId, municipalityId, existing),
  });

  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;
  const rowIdRef = useRef(surveyId ?? existing?._id);
  rowIdRef.current = surveyId ?? existing?._id;
  const setErrorRef = useRef(setError);
  setErrorRef.current = setError;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onDirtyRef = useRef(onDirty);
  onDirtyRef.current = onDirty;
  const onValidationErrorRef = useRef(onValidationError);
  onValidationErrorRef.current = onValidationError;
  const conflictLinkVariantRef = useRef(conflictLinkVariant);
  conflictLinkVariantRef.current = conflictLinkVariant;
  const routerRef = useRef(router);
  routerRef.current = router;
  const skipDirtyRef = useRef(true);

  const saveDetails = useCallback(
    (patch?: Partial<SurveyDraftValues>): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        handleSubmit(
          async (values) => {
            try {
              const id = await saveDraftRef.current({
                ...values,
                ...patch,
                ...(rowIdRef.current ? { id: rowIdRef.current as any } : {}),
                clientUpdatedAt: Date.now(),
              } as any);
              toast.success("Details saved");
              setConflictingSurveyId(undefined);
              onSavedRef.current?.(id as unknown as string);
              resolve(true);
            } catch (e) {
              const parsed = applyServerFieldErrors(e, setErrorRef.current as any);
              const conflictId = getConflictingSurveyId(e);
              setConflictingSurveyId(conflictId);
              if (parsed.code === "VALIDATION") {
                onValidationErrorRef.current?.();
              }
              if (
                !toastSurveyConflict(e, {
                  variant: conflictLinkVariantRef.current,
                  onNavigate: (href) => routerRef.current.push(href),
                })
              ) {
                toast.error(parsed.message);
              }
              resolve(false);
            }
          },
          () => resolve(false),
        )();
      });
    },
    [handleSubmit],
  );

  useImperativeHandle(ref, () => ({ save: saveDetails }), [saveDetails]);

  useEffect(() => {
    const subscription = watch(() => {
      if (skipDirtyRef.current) {
        skipDirtyRef.current = false;
        return;
      }
      onDirtyRef.current?.();
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const muniId = watch("municipalityId");
  const wards = useWardsForMunicipality(muniId);
  const propertyUse = watch("propertyUse");
  const wardNo = watch("wardNo");
  const parcelNo = watch("parcelNo");
  const unitNo = watch("unitNo");
  const subcats = propertyUse ? (masters?.propertyUseSubcategories?.[propertyUse] ?? []) : [];
  const selectedUlb = (masters?.ulbs ?? []).find((m: { _id: string }) => m._id === muniId);
  const previewPropertyId =
    formatPropertyId({
      ulbCode: selectedUlb?.code ?? "",
      wardNo: wardNo ?? "",
      parcelNo: parcelNo ?? "",
      unitNo: unitNo ?? "",
      propertyUse: propertyUse ?? "",
    }) ?? existing?.propertyId;

  const sectionProps = { control, register, errors, masters };

  return (
    <div className="space-y-4">
      <TenantPropertySection
        {...sectionProps}
        wards={wards}
        previewPropertyId={previewPropertyId}
        conflictingSurveyHref={
          conflictingSurveyId ? conflictSurveyHref(conflictingSurveyId, conflictLinkVariant) : undefined
        }
      />
      <OwnerSection {...sectionProps} />
      <AddressSection {...sectionProps} />
      <TaxationSection {...sectionProps} subcats={subcats} />
      <ServicesSection {...sectionProps} />
    </div>
  );
}
