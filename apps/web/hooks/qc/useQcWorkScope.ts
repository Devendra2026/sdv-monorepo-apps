"use client";

import { useMasters } from "@/hooks/masters/useMasters";
import {
  readQcWorkScope,
  sanitizeQcWorkScope,
  scopeFromSurveyRow,
  scopeFromUserAssignment,
  writeQcWorkScope,
  type QcTenantAllowlist,
  type QcWorkScope,
} from "@/lib/qc/work-scope";
import { useCurrentUser } from "@/lib/session";
import type { SurveyListItem } from "@/schema/surveys/index";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ActiveSurvey = Pick<SurveyListItem, "_id" | "municipalityId" | "districtId" | "wardNo">;

function allowlistFromMasters(masters: NonNullable<ReturnType<typeof useMasters>["masters"]>): QcTenantAllowlist {
  return {
    municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
    districtIds: new Set(masters.districts.map((d) => d._id)),
  };
}

export function useQcWorkScope(activeSurvey?: ActiveSurvey | null) {
  const { user } = useCurrentUser();
  const { masters } = useMasters();
  const [scope, setScopeState] = useState<QcWorkScope>({});
  const allowlist = useMemo(() => (masters ? allowlistFromMasters(masters) : null), [masters]);
  const allowlistRef = useRef(allowlist);
  allowlistRef.current = allowlist;
  const lastSyncedSurveyId = useRef<string | undefined>(undefined);

  const applyScope = useCallback((next: QcWorkScope) => {
    const allowed = allowlistRef.current;
    const sanitized = allowed ? sanitizeQcWorkScope(next, allowed) : next;
    writeQcWorkScope(sanitized);
    setScopeState(sanitized);
    return sanitized;
  }, []);

  useEffect(() => {
    const stored = readQcWorkScope();
    if (stored.districtId || stored.municipalityId || stored.wardNo) {
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
      const sanitized = sanitizeQcWorkScope(prev, allowlist);
      if (
        sanitized.districtId === prev.districtId &&
        sanitized.municipalityId === prev.municipalityId &&
        sanitized.wardNo === prev.wardNo
      ) {
        return prev;
      }
      writeQcWorkScope(sanitized);
      return sanitized;
    });
  }, [allowlist]);

  useEffect(() => {
    if (!activeSurvey) return;
    if (lastSyncedSurveyId.current === activeSurvey._id) return;
    lastSyncedSurveyId.current = activeSurvey._id;
    setScopeState((prev) => {
      const merged = { ...prev, ...scopeFromSurveyRow(activeSurvey) };
      const allowed = allowlistRef.current;
      const sanitized = allowed ? sanitizeQcWorkScope(merged, allowed) : merged;
      writeQcWorkScope(sanitized);
      return sanitized;
    });
  }, [activeSurvey]);

  const setScope = useCallback(
    (next: QcWorkScope) => {
      applyScope(next);
    },
    [applyScope],
  );

  const patchScope = useCallback((patch: Partial<QcWorkScope>) => {
    setScopeState((prev) => {
      const merged = { ...prev, ...patch };
      const allowed = allowlistRef.current;
      const sanitized = allowed ? sanitizeQcWorkScope(merged, allowed) : merged;
      writeQcWorkScope(sanitized);
      return sanitized;
    });
  }, []);

  return { scope, setScope, patchScope, scopeReady: user !== undefined };
}
