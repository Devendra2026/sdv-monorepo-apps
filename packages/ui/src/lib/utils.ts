import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtDate(ms?: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function fmtDay(ms?: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}
