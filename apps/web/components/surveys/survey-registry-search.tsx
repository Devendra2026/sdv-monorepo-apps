"use client"

import { SurveySearchInput } from "@/components/surveys/shared/survey-search-input"

export function SurveyRegistrySearch({
  value,
  onChange,
  placeholder = "Search property ID, owner, mobile, parcel…",
  inputClassName,
}: {
  value: string
  onChange: (term: string) => void
  placeholder?: string
  inputClassName?: string
}) {
  return (
    <SurveySearchInput
      label="Search registry"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      inputClassName={inputClassName ?? "h-10 rounded-lg border-primary/20 bg-background pl-9"}
    />
  )
}
