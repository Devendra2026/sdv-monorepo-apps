"use client";

import { useMasters } from "@/hooks/masters/useMasters";
import { useCurrentUser } from "@/lib/session";
import {
  readSurveyWorkScope,
  sanitizeSurveyWorkScope,
  scopeFromUserAssignment,
  writeSurveyWorkScope,
  type SurveyTenantAllowlist,
  type SurveyWorkScope,
} from "@/lib/survey/work-scope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function allowlistFromMasters(masters: NonNullable<ReturnType<typeof useMasters>["masters"]>): SurveyTenantAllowlist {
  return {
    municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
    districtIds: new Set(masters.districts.map((d) => d._id)),
  };
}

export function useSurveyWorkScope() {
  const { user } = useCurrentUser();
  const { masters } = useMasters();
  const [scope, setScopeState] = useState<SurveyWorkScope>({});
  const allowlist = useMemo(() => (masters ? allowlistFromMasters(masters) : null), [masters]);
  const allowlistRef = useRef(allowlist);
  allowlistRef.current = allowlist;

  const applyScope = useCallback((next: SurveyWorkScope) => {
    const allowed = allowlistRef.current;
    const sanitized = allowed ? sanitizeSurveyWorkScope(next, allowed) : next;
    writeSurveyWorkScope(sanitized);
    setScopeState(sanitized);
    return sanitized;
  }, []);

  useEffect(() => {
    const stored = readSurveyWorkScope();
    if (stored.districtId || stored.municipalityId || stored.wardNo || stored.status || stored.qcStatus) {
      applyScope(stored);
      return;
    }
    if (!user) return;
    const initial = scopeFromUserAssignment(user);
    if (initial.districtId || initial.municipalityId || initial.wardNo) {
      applyScope(initial);
    }
  }, [user, applyScope]);

  useEffect(() => {
    if (!allowlist) return;
    setScopeState((prev) => {
      const sanitized = sanitizeSurveyWorkScope(prev, allowlist);
      if (
        sanitized.districtId === prev.districtId &&
        sanitized.municipalityId === prev.municipalityId &&
        sanitized.wardNo === prev.wardNo &&
        sanitized.status === prev.status &&
        sanitized.qcStatus === prev.qcStatus
      ) {
        return prev;
      }
      writeSurveyWorkScope(sanitized);
      return sanitized;
    });
  }, [allowlist]);

  const setScope = useCallback(
    (next: SurveyWorkScope) => {
      applyScope(next);
    },
    [applyScope],
  );

  const patchScope = useCallback((patch: Partial<SurveyWorkScope>) => {
    setScopeState((prev) => {
      const merged = { ...prev, ...patch };
      const allowed = allowlistRef.current;
      const sanitized = allowed ? sanitizeSurveyWorkScope(merged, allowed) : merged;
      writeSurveyWorkScope(sanitized);
      return sanitized;
    });
  }, []);

  return { scope, setScope, patchScope, scopeReady: user !== undefined };
}
