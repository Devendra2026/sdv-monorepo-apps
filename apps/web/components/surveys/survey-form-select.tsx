"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SurveyDraftValues } from "@/schema/surveys/surveySchema";
import { Controller, type Control, type Path } from "react-hook-form";

export function SurveySelect({
  control,
  name,
  options,
  placeholder,
}: {
  control: Control<SurveyDraftValues>;
  name: Path<SurveyDraftValues>;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={(field.value as string) ?? ""} onValueChange={field.onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
