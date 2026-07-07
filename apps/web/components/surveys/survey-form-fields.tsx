import type { SurveyDraftValues } from "@/schema/surveys/surveySchema";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

export type SurveyFormSectionProps = {
  control: Control<SurveyDraftValues>;
  register: UseFormRegister<SurveyDraftValues>;
  errors: FieldErrors<SurveyDraftValues>;
  masters:
    | {
        ulbs?: { _id: string; name: string; code?: string }[];
        relationships?: { value: string; label: string }[];
        assessmentYears?: { value: string; label: string }[];
        ownershipTypes?: { value: string; label: string }[];
        propertyUses?: { value: string; label: string }[];
        propertyUseSubcategories?: Record<string, { value: string; label: string }[]>;
        situations?: { value: string; label: string }[];
        roadTypes?: { value: string; label: string }[];
        taxRateZones?: { value: string; label: string }[];
        waterSources?: { value: string; label: string }[];
        sanitationTypes?: { value: string; label: string }[];
      }
    | null
    | undefined;
};

export { FieldErr } from "@/components/surveys/field-err";
export { SurveyFormSection } from "@/components/surveys/survey-form-section";
export { SurveySelect } from "@/components/surveys/survey-form-select";
