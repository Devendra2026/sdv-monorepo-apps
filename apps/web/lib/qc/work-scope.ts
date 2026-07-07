/** Persisted geographic scope for QC supervisors — set once via Smart Filters on the command center. */

import {
  readWorkScope,
  sanitizeWorkScope,
  scopeFromSurveyRow,
  scopeFromUserAssignment,
  writeWorkScope,
  type BaseWorkScope,
  type TenantAllowlist,
} from "@/lib/work-scope";

export type QcWorkScope = Pick<BaseWorkScope, "districtId" | "municipalityId" | "wardNo">;

const STORAGE_KEY = "qc-work-scope";

export function readQcWorkScope(): QcWorkScope {
  return readWorkScope(STORAGE_KEY);
}

export function writeQcWorkScope(scope: QcWorkScope): void {
  writeWorkScope(STORAGE_KEY, scope);
}

export { scopeFromUserAssignment, scopeFromSurveyRow };

export function isQcScopeComplete(scope: QcWorkScope): boolean {
  return Boolean(scope.municipalityId && scope.wardNo);
}

export type QcTenantAllowlist = TenantAllowlist;

export function sanitizeQcWorkScope(scope: QcWorkScope, allowed: QcTenantAllowlist): QcWorkScope {
  return sanitizeWorkScope(scope, allowed);
}
