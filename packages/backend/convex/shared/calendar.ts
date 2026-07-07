/** Application calendar timezone — field ops run on IST. */
export const APP_TIMEZONE = "Asia/Kolkata"

const MS_PER_DAY = 86_400_000

/** YYYY-MM-DD in the given IANA timezone. */
export function formatDateKey(ms: number, timeZone: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms))

  const year = parts.find((p) => p.type === "year")?.value ?? "1970"
  const month = parts.find((p) => p.type === "month")?.value ?? "01"
  const day = parts.find((p) => p.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

/** Start-of-day timestamp (ms) for the calendar day containing `nowMs` in `timeZone`. */
export function startOfDayMs(nowMs: number, timeZone: string = APP_TIMEZONE): number {
  const dateKey = formatDateKey(nowMs, timeZone)
  return startOfDayMsFromKey(dateKey, timeZone)
}

/** Exclusive end of the calendar day that starts at `dayStartMs`. */
export function dayEndMs(dayStartMs: number): number {
  return dayStartMs + MS_PER_DAY
}

/**
 * UTC epoch ms for local midnight of `dateKey` (YYYY-MM-DD) in `timeZone`.
 * Uses noon UTC on that calendar date to avoid DST edge cases (IST has no DST).
 */
export function startOfDayMsFromKey(dateKey: string, timeZone: string = APP_TIMEZONE): number {
  const [y, m, d] = dateKey.split("-").map(Number)
  const noonUtc = Date.UTC(y!, m! - 1, d!, 12, 0, 0, 0)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
    minute: "numeric",
  }).formatToParts(new Date(noonUtc))

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12)
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return noonUtc - (hour * 60 + minute) * 60_000
}
