"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";

export function SurveyorSearch({
  value,
  onChange,
  inputClassName,
}: {
  value: string;
  onChange: (term: string) => void;
  inputClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Search surveyor</Label>
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search surveyor name…"
          className={
            inputClassName ?? "h-10 rounded-lg border-indigo-300/40 bg-background pl-9 dark:border-indigo-700/40"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
