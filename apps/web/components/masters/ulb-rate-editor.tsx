"use client";

import {
  buildWardForm,
  formToPayload,
  pct,
  pctToDecimal,
  ulbSettingsFromForm,
} from "@/components/masters/tax-rates-form-utils";
import type { RateForm, WardInfo } from "@/components/masters/tax-rates-types";
import { editorUiReducer, initialEditorUiState } from "@/components/masters/ulb-rate-editor-reducer";
import {
  UlbRateEditorEmptyWards,
  UlbRateEditorErrorBanner,
  UlbRateEditorHeader,
  UlbRateEditorTaxSettings,
  UlbRateEditorWardMatrixPanel,
  UlbRateEditorWardRail,
} from "@/components/masters/ulb-rate-editor-sections";
import { RateInput, WardRatePreview } from "@/components/masters/ulb-rate-editor-widgets";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import {
  buildDefaultMonthlyMatrix,
  cloneMonthlyMatrix,
  hasWardCustomRates,
  matricesEqual,
  monthlyFormToAnnualMatrix,
} from "@/lib/qc/tax-rate-matrix";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useMemo, useReducer, useRef, type Dispatch, type SetStateAction } from "react";

export function UlbRateEditor({
  municipalityId,
  municipalityName,
  districtName,
  wards,
}: {
  municipalityId: Id<"municipalities">;
  municipalityName: string;
  districtName: string;
  wards: WardInfo[];
}) {
  const ready = useConvexAuthReady();
  const { data: existing } = useQuery(
    convexQuery(api.taxRates.getForMunicipality, ready ? { municipalityId } : "skip"),
  );
  const upsert = useMutation(api.taxRates.upsert);
  const saveWard = useMutation(api.taxRates.saveWard);
  const reset = useMutation(api.taxRates.resetToDefaults);

  const [ui, dispatch] = useReducer(editorUiReducer, initialEditorUiState);
  const activeWardNo = useMemo(() => {
    if (ui.selectedWardNo && wards.some((w) => w.wardNo === ui.selectedWardNo)) return ui.selectedWardNo;
    return wards[0]?.wardNo ?? "";
  }, [wards, ui.selectedWardNo]);

  const serverForm = useMemo(() => {
    if (existing === undefined || wards.length === 0) return null;
    return buildWardForm(wards, existing);
  }, [existing, wards]);

  const baselineForm = useMemo(() => {
    if (!serverForm) return null;
    return {
      ...serverForm,
      wardMatrices: Object.fromEntries(
        Object.entries(serverForm.wardMatrices).map(([key, matrix]) => [key, cloneMonthlyMatrix(matrix)]),
      ),
      usageMultipliers: { ...serverForm.usageMultipliers },
    };
  }, [serverForm]);

  const prevExistingRef = useRef(existing);
  if (existing !== prevExistingRef.current) {
    prevExistingRef.current = existing;
    if (ui.draftForm !== null) dispatch({ type: "resetDraft" });
  }

  const form = ui.draftForm ?? serverForm;
  const setForm: Dispatch<SetStateAction<RateForm | null>> = (action) => {
    dispatch({
      type: "patch",
      patch: {
        draftForm: typeof action === "function" ? action(ui.draftForm ?? serverForm) : action,
      },
    });
  };

  const filteredWards = useMemo(() => {
    const q = ui.wardSearch.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter(
      (w) =>
        w.wardNo.toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || w.wardCode.toLowerCase().includes(q),
    );
  }, [wards, ui.wardSearch]);

  const selectedWard = wards.find((w) => w.wardNo === activeWardNo);
  const wardMatrix = form?.wardMatrices[activeWardNo];

  const configuredCount = useMemo(() => {
    if (!existing) return 0;
    return wards.filter((w) => hasWardCustomRates(w.wardNo, existing.wardRates)).length;
  }, [existing, wards]);

  const dirtyWardNos = useMemo(() => {
    if (!form || !baselineForm) return new Set<string>();
    const dirty = new Set<string>();
    for (const ward of wards) {
      const current = form.wardMatrices[ward.wardNo];
      const base = baselineForm.wardMatrices[ward.wardNo];
      if (current && base && !matricesEqual(current, base)) dirty.add(ward.wardNo);
    }
    return dirty;
  }, [form, baselineForm, wards]);

  const selectedWardDirty = dirtyWardNos.has(activeWardNo);
  const ulbSettingsDirty = useMemo(() => {
    if (!form || !baselineForm) return false;
    return (
      form.propertyTaxPct !== baselineForm.propertyTaxPct ||
      form.waterTaxPct !== baselineForm.waterTaxPct ||
      form.drainageTaxPct !== baselineForm.drainageTaxPct ||
      Object.keys(form.usageMultipliers).some(
        (key) => form.usageMultipliers[key] !== baselineForm.usageMultipliers[key],
      )
    );
  }, [form, baselineForm]);

  function setCell(zone: string, constr: string, val: string) {
    if (!form || !activeWardNo) return;
    setForm((f) => {
      if (!f) return f;
      const current = f.wardMatrices[activeWardNo] ?? buildDefaultMonthlyMatrix();
      return {
        ...f,
        wardMatrices: {
          ...f.wardMatrices,
          [activeWardNo]: {
            ...current,
            [zone]: { ...current[zone], [constr]: val },
          },
        },
      };
    });
  }

  async function handleSaveWard() {
    if (!form || !activeWardNo) return;
    const matrix = form.wardMatrices[activeWardNo];
    if (!matrix) return;
    dispatch({ type: "patch", patch: { error: null, savingWard: true } });
    try {
      await saveWard({
        municipalityId,
        wardNo: activeWardNo,
        wardRateMatrix: monthlyFormToAnnualMatrix(matrix),
        ...ulbSettingsFromForm(form),
      });
      dispatch({ type: "patch", patch: { wardSaved: true } });
      setTimeout(() => dispatch({ type: "patch", patch: { wardSaved: false } }), 2500);
    } catch (e) {
      dispatch({ type: "patch", patch: { error: e instanceof Error ? e.message : "Save failed" } });
    } finally {
      dispatch({ type: "patch", patch: { savingWard: false } });
    }
  }

  async function handleSave() {
    if (!form) return;
    dispatch({ type: "patch", patch: { error: null, saving: true } });
    try {
      await upsert({ municipalityId, ...formToPayload(form, wards) });
      dispatch({ type: "patch", patch: { saved: true } });
      setTimeout(() => dispatch({ type: "patch", patch: { saved: false } }), 2500);
    } catch (e) {
      dispatch({ type: "patch", patch: { error: e instanceof Error ? e.message : "Save failed" } });
    } finally {
      dispatch({ type: "patch", patch: { saving: false } });
    }
  }

  async function handleResetAll() {
    dispatch({ type: "patch", patch: { resetting: true } });
    try {
      await reset({ municipalityId });
      setForm(buildWardForm(wards, null));
    } finally {
      dispatch({ type: "patch", patch: { resetting: false } });
    }
  }

  if (existing === undefined || !form) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading rate schedule…
      </div>
    );
  }

  if (wards.length === 0) {
    return <UlbRateEditorEmptyWards />;
  }

  const combinedPctLabel = pct(
    pctToDecimal(form.propertyTaxPct) + pctToDecimal(form.waterTaxPct) + pctToDecimal(form.drainageTaxPct),
  );

  return (
    <div className="space-y-5">
      <UlbRateEditorHeader
        municipalityName={municipalityName}
        districtName={districtName}
        wardCount={wards.length}
        configuredCount={configuredCount}
        existing={existing}
        saving={ui.saving}
        saved={ui.saved}
        resetting={ui.resetting}
        onResetAll={handleResetAll}
        onSaveAll={handleSave}
      />

      {ui.error ? <UlbRateEditorErrorBanner error={ui.error} /> : null}

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <UlbRateEditorWardRail
          wardSearch={ui.wardSearch}
          onWardSearchChange={(value) => dispatch({ type: "patch", patch: { wardSearch: value } })}
          filteredWards={filteredWards}
          activeWardNo={activeWardNo}
          onSelectWard={(wardNo) => dispatch({ type: "patch", patch: { selectedWardNo: wardNo } })}
          existing={existing}
          dirtyWardNos={dirtyWardNos}
        />

        <div className="space-y-5">
          {selectedWard && wardMatrix ? (
            <UlbRateEditorWardMatrixPanel
              selectedWard={selectedWard}
              wardMatrix={wardMatrix}
              form={form}
              savingWard={ui.savingWard}
              wardSaved={ui.wardSaved}
              selectedWardDirty={selectedWardDirty}
              ulbSettingsDirty={ulbSettingsDirty}
              previewZoneKey={ui.previewZoneKey}
              previewConstrKey={ui.previewConstrKey}
              onPreviewZoneChange={(key) => dispatch({ type: "patch", patch: { previewZoneKey: key } })}
              onPreviewConstrChange={(key) => dispatch({ type: "patch", patch: { previewConstrKey: key } })}
              onApplyDefault={() => {
                if (!form || !activeWardNo) return;
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        wardMatrices: {
                          ...f.wardMatrices,
                          [activeWardNo]: cloneMonthlyMatrix(f.defaultMatrix),
                        },
                      }
                    : f,
                );
              }}
              onResetSystemDefault={() => {
                if (!form || !activeWardNo) return;
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        wardMatrices: {
                          ...f.wardMatrices,
                          [activeWardNo]: buildDefaultMonthlyMatrix(),
                        },
                      }
                    : f,
                );
              }}
              onCopyToAll={() => {
                if (!form || !activeWardNo) return;
                const source = form.wardMatrices[activeWardNo];
                if (!source) return;
                setForm((f) => {
                  if (!f) return f;
                  const wardMatrices = { ...f.wardMatrices };
                  for (const w of wards) {
                    wardMatrices[w.wardNo] = cloneMonthlyMatrix(source);
                  }
                  return { ...f, wardMatrices };
                });
              }}
              onSaveWard={handleSaveWard}
              onCellChange={setCell}
              WardRatePreview={WardRatePreview}
              RateInput={RateInput}
            />
          ) : null}

          <UlbRateEditorTaxSettings
            form={form}
            onFormPatch={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
            combinedPctLabel={combinedPctLabel}
          />
        </div>
      </div>
    </div>
  );
}
