/** Primary owner name for display — owners array first, then respondent fallback. */
export function resolveOwnerDisplayName(survey: { owners?: { name?: string }[]; respondentName?: string }): string {
  return survey.owners?.[0]?.name ?? survey.respondentName ?? "—";
}
