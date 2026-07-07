"use client"

import { SurveySearchInput } from "@/components/surveys/shared/survey-search-input"

export function SurveyorSearch({
  value,
  onChange,
  inputClassName,
}: {
  value: string
  onChange: (term: string) => void
  inputClassName?: string
}) {
  return (
    <SurveySearchInput
      label="Search surveyor"
      placeholder="Search surveyor name…"
      value={value}
      onChange={onChange}
      inputClassName={
        inputClassName ?? "h-10 rounded-lg border-indigo-300/40 bg-background pl-9 dark:border-indigo-700/40"
      }
    />
  )
}
