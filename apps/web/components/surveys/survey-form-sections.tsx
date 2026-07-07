"use client";

import {
  FieldErr,
  SurveyFormSection,
  SurveySelect,
  type SurveyFormSectionProps,
} from "@/components/surveys/survey-form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MAX_SURVEY_OWNERS } from "@/lib/domain";
import { Building2, Droplets, MapPinHouse, Plus, Receipt, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { Controller, useFieldArray } from "react-hook-form";

type WardOption = { wardNo: string };

export function TenantPropertySection({
  control,
  register,
  errors,
  masters,
  wards,
  previewPropertyId,
  conflictingSurveyHref,
}: SurveyFormSectionProps & {
  wards?: WardOption[];
  previewPropertyId?: string;
  conflictingSurveyHref?: string;
}) {
  return (
    <SurveyFormSection title="Tenant & Property" icon={<Building2 className="h-4 w-4" aria-hidden />}>
      <div className="space-y-1.5">
        <Label>Municipality (ULB)</Label>
        <SurveySelect
          control={control}
          name="municipalityId"
          options={(masters?.ulbs ?? []).map((m) => ({ value: m._id, label: m.name }))}
          placeholder="Select ULB"
        />
        <FieldErr msg={errors.municipalityId?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Ward</Label>
        <SurveySelect
          control={control}
          name="wardNo"
          options={(wards ?? []).map((w) => ({ value: w.wardNo, label: `Ward ${w.wardNo}` }))}
          placeholder="Select ward"
        />
        <FieldErr msg={errors.wardNo?.message} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Property ID</Label>
        <Input
          readOnly
          value={previewPropertyId ?? ""}
          placeholder="Auto-generated after ward, parcel & property use"
          className="bg-muted/50 font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Format: ULB (6 digits) – Ward (3 digits) – Parcel (5 digits) – Unit (3 digits) – Use letter, e.g.
          801262-001-00004-001-R
        </p>
        <FieldErr msg={errors.propertyId?.message?.replace(/\s*— conflicts with survey [^-]+$/, "")} />
        {conflictingSurveyHref ? (
          <Link
            href={conflictingSurveyHref}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            View conflicting survey
          </Link>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>Parcel No</Label>
        <Input {...register("parcelNo")} />
        <FieldErr msg={errors.parcelNo?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Unit No</Label>
        <Input {...register("unitNo")} />
        <FieldErr msg={errors.unitNo?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Sector No</Label>
        <Input {...register("sectorNo")} />
      </div>
      <div className="space-y-1.5">
        <Label>Old Property No</Label>
        <Input {...register("oldPropertyNo")} />
      </div>
      <div className="space-y-1.5">
        <Label>Constructed Year</Label>
        <Input type="number" {...register("constructedYear", { valueAsNumber: true })} />
        <FieldErr msg={errors.constructedYear?.message} />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <Controller
          control={control}
          name="isSlum"
          render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
        />
        <Label>Slum property</Label>
      </div>
    </SurveyFormSection>
  );
}

export function OwnerSection({ control, register, errors, masters }: SurveyFormSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "owners",
  });

  return (
    <SurveyFormSection title="Owner" icon={<Users className="h-4 w-4" aria-hidden />}>
      <div className="space-y-1.5">
        <Label>Respondent name</Label>
        <Input {...register("respondentName")} />
      </div>
      <div className="space-y-1.5">
        <Label>Relationship with Owner</Label>
        <SurveySelect
          control={control}
          name="relationship"
          options={masters?.relationships ?? []}
          placeholder="Select"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Family size</Label>
        <Input type="number" {...register("familySize", { valueAsNumber: true })} />
        <FieldErr msg={errors.familySize?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Primary mobile</Label>
        <Input {...register("mobileNo")} />
        <FieldErr msg={errors.mobileNo?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Alt mobile</Label>
        <Input {...register("altMobileNo")} />
      </div>
      <div className="space-y-2 sm:col-span-2 lg:col-span-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Co-owner details</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: "", fatherOrHusbandName: "", mobileNo: "", altMobileNo: "" })}
            disabled={fields.length >= MAX_SURVEY_OWNERS}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add owner
          </Button>
        </div>
        <div className="space-y-3">
          {fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
              No co-owners added.
            </p>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="rounded-xl border border-border/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">Owner #{index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input {...register(`owners.${index}.name`)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Father / Husband Name</Label>
                    <Input {...register(`owners.${index}.fatherOrHusbandName`)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mobile</Label>
                    <Input {...register(`owners.${index}.mobileNo`)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alt Mobile</Label>
                    <Input {...register(`owners.${index}.altMobileNo`)} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SurveyFormSection>
  );
}

export function AddressSection({ register, errors }: SurveyFormSectionProps) {
  return (
    <SurveyFormSection title="Address" icon={<MapPinHouse className="h-4 w-4" aria-hidden />}>
      <div className="space-y-1.5">
        <Label>House No</Label>
        <Input {...register("houseNo")} />
      </div>
      <div className="space-y-1.5">
        <Label>Locality</Label>
        <Input {...register("locality")} />
        <FieldErr msg={errors.locality?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Colony name</Label>
        <Input {...register("colonyName")} />
      </div>
      <div className="space-y-1.5">
        <Label>PIN code</Label>
        <Input {...register("pinCode")} />
      </div>
    </SurveyFormSection>
  );
}

export function TaxationSection({
  control,
  errors,
  masters,
  subcats,
}: SurveyFormSectionProps & {
  subcats: { value: string; label: string }[];
}) {
  return (
    <SurveyFormSection title="Taxation" icon={<Receipt className="h-4 w-4" aria-hidden />}>
      <div className="space-y-1.5">
        <Label>Assessment year</Label>
        <SurveySelect
          control={control}
          name="assessmentYear"
          options={masters?.assessmentYears ?? []}
          placeholder="Select"
        />
        <FieldErr msg={errors.assessmentYear?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Ownership type</Label>
        <SurveySelect
          control={control}
          name="ownershipType"
          options={masters?.ownershipTypes ?? []}
          placeholder="Select"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Property use</Label>
        <SurveySelect control={control} name="propertyUse" options={masters?.propertyUses ?? []} placeholder="Select" />
      </div>
      <div className="space-y-1.5">
        <Label>Property type / subcategory</Label>
        <SurveySelect
          control={control}
          name="propertyType"
          options={subcats}
          placeholder={subcats.length ? "Select" : "Pick a property use first"}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Situation</Label>
        <SurveySelect control={control} name="situation" options={masters?.situations ?? []} placeholder="Select" />
      </div>
      <div className="space-y-1.5">
        <Label>Road type</Label>
        <SurveySelect control={control} name="roadType" options={masters?.roadTypes ?? []} placeholder="Select" />
      </div>
      <div className="space-y-1.5">
        <Label>Tax rate zone</Label>
        <SurveySelect control={control} name="taxRateZone" options={masters?.taxRateZones ?? []} placeholder="Select" />
      </div>
    </SurveyFormSection>
  );
}

export function ServicesSection({ control, errors, masters }: SurveyFormSectionProps) {
  return (
    <SurveyFormSection title="Services" icon={<Droplets className="h-4 w-4" aria-hidden />}>
      <div className="flex items-center gap-2 pt-6">
        <Controller
          control={control}
          name="municipalWaterConnection"
          render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
        />
        <Label>Municipal water connection</Label>
      </div>
      <div className="space-y-1.5">
        <Label>Water source</Label>
        <SurveySelect control={control} name="waterSource" options={masters?.waterSources ?? []} placeholder="Select" />
        <FieldErr msg={errors.waterSource?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Sanitation type</Label>
        <SurveySelect
          control={control}
          name="sanitationType"
          options={masters?.sanitationTypes ?? []}
          placeholder="Select"
        />
      </div>
      <div className="flex items-center gap-2 pt-6">
        <Controller
          control={control}
          name="municipalWasteCollection"
          render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />}
        />
        <Label>Door-to-door waste collection</Label>
      </div>
    </SurveyFormSection>
  );
}
