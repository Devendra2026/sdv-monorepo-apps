import type { RateForm } from "@/components/masters/tax-rates-types";

export type EditorUiState = {
  selectedWardNo: string;
  wardSearch: string;
  draftForm: RateForm | null;
  saving: boolean;
  savingWard: boolean;
  resetting: boolean;
  saved: boolean;
  wardSaved: boolean;
  previewZoneKey: string;
  previewConstrKey: string;
  error: string | null;
};

export const initialEditorUiState: EditorUiState = {
  selectedWardNo: "",
  wardSearch: "",
  draftForm: null,
  saving: false,
  savingWard: false,
  resetting: false,
  saved: false,
  wardSaved: false,
  previewZoneKey: "below_9m",
  previewConstrKey: "pakka_rcc_rb",
  error: null,
};

export type EditorUiAction =
  | { type: "patch"; patch: Partial<EditorUiState> }
  | { type: "resetDraft" };

export function editorUiReducer(state: EditorUiState, action: EditorUiAction): EditorUiState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "resetDraft":
      return { ...state, draftForm: null };
    default:
      return state;
  }
}
