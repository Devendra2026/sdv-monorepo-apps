/** Timestamp for report / notice documents — always the generation date, not survey submit or QC approval. */
export function reportDocumentTimestamp(): number {
  return Date.now();
}

export function formatReportDocumentDate(ms: number = reportDocumentTimestamp()): string {
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
