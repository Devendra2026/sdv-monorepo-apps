/**
 * Lightweight structured timing helpers for Convex mutations/actions.
 * Prefer these over ad-hoc console.log — keeps production logs greppable.
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
