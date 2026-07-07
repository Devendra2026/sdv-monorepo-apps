/** Shared localStorage work-scope helpers for survey and QC modules. */

export type BaseWorkScope = {
  districtId?: string;
  municipalityId?: string;
  wardNo?: string;
  status?: string;
  qcStatus?: string;
};

export type TenantAllowlist = {
  municipalityIds: ReadonlySet<string>;
  districtIds: ReadonlySet<string>;
};

export function readWorkScope(storageKey: string): BaseWorkScope {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BaseWorkScope;
    return {
      districtId: parsed.districtId || undefined,
      municipalityId: parsed.municipalityId || undefined,
      wardNo: parsed.wardNo || undefined,
      status: parsed.status || undefined,
      qcStatus: parsed.qcStatus || undefined,
    };
  } catch {
    return {};
  }
}

export function writeWorkScope(storageKey: string, scope: BaseWorkScope): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(scope));
}

export function scopeFromUserAssignment(user: {
  districtId?: string;
  municipalityId?: string;
  wardAssignments?: string[];
}): BaseWorkScope {
  const scope: BaseWorkScope = {};
  if (user.districtId) scope.districtId = user.districtId;
  if (user.municipalityId) scope.municipalityId = user.municipalityId;
  if (user.wardAssignments?.[0]) scope.wardNo = user.wardAssignments[0];
  return scope;
}

export function sanitizeWorkScope(scope: BaseWorkScope, allowed: TenantAllowlist): BaseWorkScope {
  const next: BaseWorkScope = { ...scope };
  if (next.municipalityId && !allowed.municipalityIds.has(next.municipalityId)) {
    delete next.municipalityId;
    delete next.wardNo;
  }
  if (next.districtId && !allowed.districtIds.has(next.districtId)) {
    delete next.districtId;
  }
  return next;
}

export function scopeFromSurveyRow(survey: {
  municipalityId?: string;
  districtId?: string;
  wardNo?: string;
}): BaseWorkScope {
  return {
    municipalityId: survey.municipalityId,
    districtId: survey.districtId,
    wardNo: survey.wardNo,
  };
}
