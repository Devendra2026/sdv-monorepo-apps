const PERF_ENABLED = process.env.NODE_ENV !== "production"

function safeNow(): number {
  // Use performance.now when available to avoid Date skew.
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now()
  return Date.now()
}

export function qcPerfMark(mark: string): void {
  if (!PERF_ENABLED) return
  if (typeof performance === "undefined") return
  performance.mark(mark)
}

export function qcPerfMeasure(measure: string, startMark: string, endMark: string): void {
  if (!PERF_ENABLED) return
  if (typeof performance === "undefined") return
  performance.measure(measure, startMark, endMark)
  // Keep the timeline clean between repeated navigations.
  performance.clearMarks(startMark)
  performance.clearMarks(endMark)
}

export function qcPerfNowLabel(prefix: string): string {
  return `${prefix}.${Math.round(safeNow())}`
}
