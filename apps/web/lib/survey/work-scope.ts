/** Persisted geographic + status scope for field survey supervisors. */

import {
    readWorkScope,
    sanitizeWorkScope,
    scopeFromUserAssignment,
    writeWorkScope,
    type BaseWorkScope,
    type TenantAllowlist,
} from "@/lib/work-scope";

export type SurveyWorkScope = Pick<BaseWorkScope, "districtId" | "municipalityId" | "wardNo" | "status" | "qcStatus">;

const STORAGE_KEY = "survey-work-scope";

export function readSurveyWorkScope(): SurveyWorkScope {
  return readWorkScope(STORAGE_KEY);
}

export function writeSurveyWorkScope(scope: SurveyWorkScope): void {
  writeWorkScope(STORAGE_KEY, scope);
}

export { scopeFromUserAssignment };

export function isSurveyScopeComplete(scope: SurveyWorkScope): boolean {
  return Boolean(scope.municipalityId);
}

export type SurveyTenantAllowlist = TenantAllowlist;

export function sanitizeSurveyWorkScope(scope: SurveyWorkScope, allowed: SurveyTenantAllowlist): SurveyWorkScope {
  return sanitizeWorkScope(scope, allowed);
}
