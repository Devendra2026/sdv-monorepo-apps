import { ConvexError } from "convex/values";
import { toast } from "sonner";

/** Server error payload shape (see helpers.ts `clientError`). */
export interface ServerErr {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

/** Detail keys that are metadata, not react-hook-form field names. */
const SERVER_ERROR_META_FIELDS = new Set(["conflictingSurveyId"]);

export function parseConvexError(err: unknown): ServerErr {
  if (err instanceof ConvexError && typeof err.data === "object" && err.data) {
    const d = err.data as Partial<ServerErr>;
    return { code: d.code ?? "ERROR", message: d.message ?? "Something went wrong", details: d.details };
  }
  if (err instanceof Error) return { code: "ERROR", message: err.message };
  return { code: "ERROR", message: "Unexpected error" };
}

/** Prefer the first field-level validation message over the generic summary. */
export function convexValidationSummary(err: unknown): string {
  const parsed = parseConvexError(err);
  if (parsed.details) {
    for (const [field, msgs] of Object.entries(parsed.details)) {
      if (SERVER_ERROR_META_FIELDS.has(field)) continue;
      const first = msgs[0];
      if (first) return first;
    }
  }
  return parsed.message;
}

/** Conflicting survey row id from a uniqueness CONFLICT error, if present. */
export function getConflictingSurveyId(err: unknown): string | undefined {
  return parseConvexError(err).details?.conflictingSurveyId?.[0];
}

export type ConflictSurveyLinkVariant = "surveys" | "qc";

export function conflictSurveyHref(conflictingId: string, variant: ConflictSurveyLinkVariant = "surveys"): string {
  return variant === "qc" ? `/qc/${conflictingId}` : `/surveys/${conflictingId}`;
}

function conflictToastMessage(err: unknown): string {
  const parsed = parseConvexError(err);
  if (parsed.details?.propertyId) {
    return "A survey with this Property ID already exists.";
  }
  if (parsed.details?.parcelNo) {
    return "A survey already exists for this ward, parcel, unit, and property use.";
  }
  return parsed.message.replace(/\s*\(survey [^)]+\)/, "");
}

/**
 * Show a conflict toast with navigation to the other survey row.
 * Returns true when handled; callers should fall back to a generic error toast otherwise.
 */
export function toastSurveyConflict(
  err: unknown,
  options?: {
    variant?: ConflictSurveyLinkVariant;
    onNavigate?: (href: string) => void;
  },
): boolean {
  const parsed = parseConvexError(err);
  const conflictingId = getConflictingSurveyId(err);
  if (parsed.code !== "CONFLICT" || !conflictingId) return false;

  const href = conflictSurveyHref(conflictingId, options?.variant);
  const navigate =
    options?.onNavigate ??
    ((target: string) => {
      window.location.assign(target);
    });

  toast.error(conflictToastMessage(err), {
    action: {
      label: "View conflicting survey",
      onClick: () => navigate(href),
    },
  });
  return true;
}

/** Flatten field-level `details` into react-hook-form setError calls. */
export function applyServerFieldErrors(
  err: unknown,
  setError: (name: string, e: { type: string; message: string }) => void,
): ServerErr {
  const parsed = parseConvexError(err);
  if (parsed.details) {
    for (const [field, msgs] of Object.entries(parsed.details)) {
      if (SERVER_ERROR_META_FIELDS.has(field)) continue;
      setError(field, { type: "server", message: msgs.join(", ") });
    }
  }
  return parsed;
}
