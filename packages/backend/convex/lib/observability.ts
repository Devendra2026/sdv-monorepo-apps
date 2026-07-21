/**
 * Lightweight structured timing helpers for Convex mutations/queries.
 * Prefer these over ad-hoc console.log — keeps production logs greppable.
 * Never log PII, tokens, or full document payloads.
 */
export function logSlowPath(
  label: string,
  startedAtMs: number,
  extra?: Record<string, string | number | boolean | undefined>,
): void {
  const durationMs = Date.now() - startedAtMs;
  // Only emit when noticeably slow — avoid log spam on happy path.
  if (durationMs < 250) return;
  console.warn(
    JSON.stringify({
      level: "warn",
      kind: "slow_path",
      label,
      durationMs,
      ...extra,
    }),
  );
}

/** Always emit for budget-boundary events (rejects, truncations, batch caps). */
export function logBudgetEvent(
  label: string,
  extra?: Record<string, string | number | boolean | undefined>,
): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      kind: "budget_event",
      label,
      ...extra,
    }),
  );
}
