"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

export function SurveyRegistrySearch({
  value,
  onChange,
  placeholder = "Search property ID, owner, mobile, parcel…",
  inputClassName,
}: {
  value: string;
  onChange: (term: string) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Search registry</Label>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className={inputClassName ?? "h-10 rounded-lg border-primary/20 bg-background pl-9"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
