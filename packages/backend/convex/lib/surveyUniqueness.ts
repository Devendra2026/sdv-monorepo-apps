import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { clientError } from "../shared/helpers"
import { normalizeParcelKey, padParcelNo, padUnitNo, resolvePropertyId } from "./propertyId"

const PARCEL_TAKE_CAP = 50

function wardNumbersMatch(rowWard: string, filterWard: string): boolean {
  if (rowWard === filterWard) return true
  const a = Number(rowWard)
  const b = Number(filterWard)
  return !Number.isNaN(a) && !Number.isNaN(b) && a === b
}

function parcelVariants(parcelNo: string): string[] {
  const raw = parcelNo.trim()
  const normalized = normalizeParcelKey(parcelNo)
  const padded = padParcelNo(parcelNo)
  return [...new Set([raw, normalized, padded].filter((v) => v.length > 0))]
}

function wardVariants(wardNo: string): string[] {
  const variants = new Set([wardNo.trim()])
  const wardNum = Number(wardNo)
  if (!Number.isNaN(wardNum)) {
    variants.add(String(wardNum))
    variants.add(String(wardNum).padStart(2, "0"))
    variants.add(String(wardNum).padStart(3, "0"))
  }
  return [...variants].filter((v) => v.length > 0)
}

function rowConflictsSlot(
  row: Doc<"surveys">,
  input: {
    wardNo: string
    parcelKey: string
    unitKey: string
    useKey: string
    excludeId?: Id<"surveys">
  }
): boolean {
  if (row._id === input.excludeId) return false
  if (!wardNumbersMatch(row.wardNo, input.wardNo)) return false
  if (normalizeParcelKey(row.parcelNo) !== input.parcelKey) return false
  if ((row.propertyUse ?? "").trim() !== input.useKey) return false
  const rowUnitKey = padUnitNo(row.unitNo ?? "") || (row.unitNo ?? "").trim()
  return rowUnitKey === input.unitKey
}

/** True when a draft save would change ward / parcel / unit / use / resolved Property ID. */
export function surveyIdentifyingSlotChanged(
  existing: Doc<"surveys">,
  normalized: {
    wardNo?: string
    parcelNo?: string
    unitNo?: string
    propertyUse?: string
    propertyId?: string
  },
  ulbCode: string
): boolean {
  const ward = (normalized.wardNo ?? existing.wardNo).trim()
  const parcel = normalized.parcelNo ?? existing.parcelNo
  const unit = (normalized.unitNo ?? existing.unitNo).trim()
  const use = (normalized.propertyUse ?? existing.propertyUse ?? "").trim()

  if (!wardNumbersMatch(ward, existing.wardNo)) return true
  if (normalizeParcelKey(parcel) !== normalizeParcelKey(existing.parcelNo)) return true
  const unitKey = padUnitNo(unit) || unit
  const existingUnitKey = padUnitNo(existing.unitNo) || existing.unitNo.trim()
  if (unitKey !== existingUnitKey) return true
  if (use !== (existing.propertyUse ?? "").trim()) return true

  const beforeId = resolvePropertyId(existing, ulbCode)
  const afterId = resolvePropertyId(
    { propertyId: normalized.propertyId, wardNo: ward, parcelNo: parcel, unitNo: unit, propertyUse: use },
    ulbCode
  )
  return beforeId !== afterId
}

/** Reject duplicate Property IDs and duplicate ward + parcel + use + unit slots. */
export async function assertUniqueSurveySlot(
  ctx: MutationCtx,
  input: {
    municipalityId: Id<"municipalities">
    wardNo: string
    parcelNo: string
    propertyUse?: string
    unitNo?: string
    propertyId?: string
    excludeId?: Id<"surveys">
  }
): Promise<void> {
  const propertyId = input.propertyId?.trim().toUpperCase()
  if (propertyId) {
    const matches = await ctx.db
      .query("surveys")
      .withIndex("by_property_id", (q) => q.eq("propertyId", propertyId))
      .take(2)
    const byPropertyId = matches.find((row) => row._id !== input.excludeId)
    if (byPropertyId) {
      clientError("CONFLICT", `A survey with this Property ID already exists (survey ${byPropertyId._id})`, {
        propertyId: [`duplicate property ID — conflicts with survey ${byPropertyId._id}`],
        conflictingSurveyId: [byPropertyId._id],
      })
    }
  }

  const parcelKey = normalizeParcelKey(input.parcelNo)
  const unitKey = padUnitNo(input.unitNo ?? "") || (input.unitNo ?? "").trim()
  const useKey = (input.propertyUse ?? "").trim()
  const slot = { wardNo: input.wardNo, parcelKey, unitKey, useKey, excludeId: input.excludeId }

  const seen = new Set<string>()
  for (const ward of wardVariants(input.wardNo)) {
    for (const parcel of parcelVariants(input.parcelNo)) {
      const candidates = await ctx.db
        .query("surveys")
        .withIndex("by_municipality_ward_parcel", (q) =>
          q.eq("municipalityId", input.municipalityId).eq("wardNo", ward).eq("parcelNo", parcel)
        )
        .take(PARCEL_TAKE_CAP)

      for (const row of candidates) {
        if (seen.has(row._id)) continue
        seen.add(row._id)
        if (!rowConflictsSlot(row, slot)) continue
        clientError(
          "CONFLICT",
          `A survey already exists for this ward, parcel, unit, and property use (survey ${row._id})`,
          {
            parcelNo: ["duplicate parcel in this ward"],
            unitNo: ["duplicate unit for this parcel"],
            propertyUse: ["duplicate property use for this parcel"],
            conflictingSurveyId: [row._id],
          }
        )
      }
    }
  }
}

export type SurveySlotInput = Pick<
  Doc<"surveys">,
  "municipalityId" | "wardNo" | "parcelNo" | "propertyUse" | "unitNo" | "propertyId"
>
