"use client"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Search } from "lucide-react"

export function SurveySearchInput({
  label,
  placeholder,
  value,
  onChange,
  inputClassName,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (term: string) => void
  inputClassName?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className={inputClassName ?? "h-10 rounded-lg border-border/60 bg-background pl-9 shadow-premium-sm"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}
