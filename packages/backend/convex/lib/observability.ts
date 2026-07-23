/**
 * Lightweight structured timing helpers for Convex mutations/queries.
 * Prefer these over ad-hoc console.log — keeps production logs greppable.
 * Never log PII, tokens, or full document payloads.
 */

export type TimingExtra = Record<string, string | number | boolean | undefined>

/** Short request id for correlating logs within one UDF invocation. */
export function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function logSlowPath(label: string, startedAtMs: number, extra?: TimingExtra): void {
  const durationMs = Date.now() - startedAtMs
  // Only emit when noticeably slow — avoid log spam on happy path.
  if (durationMs < 250) return
  console.warn(
    JSON.stringify({
      level: "warn",
      kind: "slow_path",
      label,
      durationMs,
      ...extra,
    })
  )
}

/**
 * Always-on phase timer for diagnosing production timeouts (analyticsBundle, etc.).
 * Emits every phase so logs show which helper owns wall time / SQLite cost.
 */
export function logPhaseTiming(label: string, startedAtMs: number, extra?: TimingExtra): number {
  const durationMs = Date.now() - startedAtMs
  console.log(
    JSON.stringify({
      level: "info",
      kind: "phase_timing",
      label,
      durationMs,
      ...extra,
    })
  )
  return Date.now()
}

/**
 * Always-on mutation/query end timing for hot UDFs (linkPhoto, saveDraft, upsert).
 * Emits even on fast paths so isolate/timeout incidents can be correlated.
 */
export function logMutationTiming(label: string, startedAtMs: number, extra?: TimingExtra): void {
  const durationMs = Date.now() - startedAtMs
  console.log(
    JSON.stringify({
      level: "info",
      kind: "mutation_timing",
      label,
      durationMs,
      ...extra,
    })
  )
}

/** Always emit for budget-boundary events (rejects, truncations, batch caps). */
export function logBudgetEvent(label: string, extra?: TimingExtra): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      kind: "budget_event",
      label,
      ...extra,
    })
  )
}
