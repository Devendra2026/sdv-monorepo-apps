import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const APP_LOCALE = "en-IN"

export function fmtDate(ms?: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleString(APP_LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function fmtDay(ms?: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleDateString(APP_LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}
