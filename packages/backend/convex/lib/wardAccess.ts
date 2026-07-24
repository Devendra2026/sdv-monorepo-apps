import type { Doc, Id } from "../_generated/dataModel"

/** Match ward numbers so "1", "01", and "001" are treated as the same ward. */
function wardNumbersMatch(a: string, b: string): boolean {
  if (a === b) return true
  const na = Number(a)
  const nb = Number(b)
  return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb
}

/**
 * Pure ward-access check — municipality scope is enforced separately via tenancy.
 * Supervisors and admins see every ward in their allotted ULBs.
 * Surveyors and QC supervisors with ward assignments are limited to those wards.
 * Ward numbers are compared numerically so assignment "1" matches survey "01".
 */
export function canReadWard(user: Doc<"users">, _municipalityId: Id<"municipalities">, wardNo: string): boolean {
  if (!wardNo?.trim()) return true
  if (user.role === "admin" || user.role === "supervisor") return true
  if (user.wardAssignments.length === 0) return true
  return user.wardAssignments.some((w) => wardNumbersMatch(w.trim(), wardNo.trim()))
}
