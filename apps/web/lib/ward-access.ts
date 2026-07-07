/**
 * Pure ward-access rules shared by Convex helpers and unit tests.
 * Municipality scope must be enforced separately via assertMunicipalityInScope.
 */
export type WardAccessUser = {
  role: string;
  wardAssignments: string[];
};

function wardNumbersMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
}

export function canReadWard(user: WardAccessUser, _municipalityId: string, wardNo: string): boolean {
  if (!wardNo?.trim()) return true;
  if (user.role === "admin" || user.role === "supervisor") return true;
  if (user.wardAssignments.length === 0) return true;
  return user.wardAssignments.some((assigned) => wardNumbersMatch(assigned, wardNo));
}
