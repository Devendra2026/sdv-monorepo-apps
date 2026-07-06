/**
 * Address-step business rules — locality, colony, tenant city/district, admin PIN.
 */
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { loadActiveMastersByCategories } from "../lib/mastersLoad"
import { MAX_SURVEY_OWNERS, RESPONDENT_RELATIONSHIP_VALUES } from "../lib/masters/ownerConstants"
import {
  isRespondentOwner,
  isValidIndianOwnerMobile,
  primaryOwnerMobileFromOwners,
} from "../lib/masters/ownerMobile"

export {
  MAX_SURVEY_OWNERS,
  RESPONDENT_RELATIONSHIPS,
  RESPONDENT_RELATIONSHIP_VALUES,
  type RespondentRelationshipValue,
} from "../lib/masters/ownerConstants"

export {
  OWNER_MOBILE_UNKNOWN,
  isAcceptedOwnerMobile,
  isRespondentOwner,
  isValidIndianOwnerMobile,
  primaryOwnerMobileFromOwners,
} from "../lib/masters/ownerMobile"

interface Option {
  value: string
  label: string
}

/** Master categories included in `bundle` dropdown payloads. */
export const MASTER_BUNDLE_CATEGORIES = [
  "assessment_year",
  "ownership_type",
  "property_use",
  "situation",
  "road_type",
  "tax_rate_zone",
  "water_source",
  "sanitation_type",
  "usage_factor",
  "usage_type",
  "floor_usage_type",
  "construction_type",
  "floor_name",
] as const

export async function loadActiveMastersByCategory(ctx: QueryCtx): Promise<Record<string, Option[]>> {
  const categorySet = new Set<string>(MASTER_BUNDLE_CATEGORIES)
  const rows = (await loadActiveMastersByCategories(ctx, MASTER_BUNDLE_CATEGORIES)).filter((m) =>
    categorySet.has(m.category)
  )
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.position - b.position)

  const grouped: Record<string, Option[]> = {}
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category]!.push({ value: row.value, label: row.label })
  }
  return grouped
}

/** Load wards only for municipalities in scope (indexed per ULB — not a full-table scan). */
export async function loadWardsForMunicipalities(
  ctx: QueryCtx,
  municipalities: Doc<"municipalities">[]
): Promise<
  Array<{
    _id: Id<"wards">
    municipalityId: Id<"municipalities">
    municipalityCode: string
    wardNo: string
    wardCode: string
    name: string
  }>
> {
  const muniById = new Map(municipalities.map((m) => [m._id, m]))
  const wardRows = await Promise.all(
    municipalities.map((muni) =>
      ctx.db
        .query("wards")
        .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", muni._id))
        .collect()
    )
  )

  const wardOut: Array<{
    _id: Id<"wards">
    municipalityId: Id<"municipalities">
    municipalityCode: string
    wardNo: string
    wardCode: string
    name: string
  }> = []

  for (const rows of wardRows) {
    for (const w of rows) {
      wardOut.push({
        _id: w._id,
        municipalityId: w.municipalityId,
        municipalityCode: muniById.get(w.municipalityId)?.code ?? "",
        wardNo: w.wardNo,
        wardCode: w.wardCode ?? w.wardNo,
        name: w.name,
      })
    }
  }

  return wardOut
}

export const PIN_CODE_RE = /^[1-9]\d{5}$/

export type AddressFields = {
  houseNo?: string
  locality?: string
  colonyName?: string
  /** @deprecated use colonyName — accepted during upsert for older clients */
  street?: string
  city?: string
  pinCode?: string
}

export type AddressTenantContext = {
  districtId: Id<"districts">
  districtName: string
  municipalityId: Id<"municipalities">
  cityName: string
  postalCode: string | null
}

export function isValidPinFormat(pin: string): boolean {
  return PIN_CODE_RE.test(pin)
}

/** Trim optional house; require trimmed locality/colony; city from ULB; normalize PIN digits. */
export function normalizeAddressFields<T extends AddressFields>(
  input: T,
  tenant: Pick<Doc<"municipalities">, "name">
): T & { locality: string; colonyName: string; city: string; pinCode: string; houseNo?: string } {
  const trimOpt = (s?: string) => {
    const t = s?.trim()
    return t ? t : undefined
  }
  const colony = trimOpt(input.colonyName) ?? trimOpt(input.street) ?? ""
  const pin = (input.pinCode ?? "").replace(/\D/g, "").slice(0, 6)
  return {
    ...input,
    houseNo: trimOpt(input.houseNo),
    locality: (input.locality ?? "").trim(),
    colonyName: colony,
    city: tenant.name.trim(),
    pinCode: pin,
  }
}

export type AddressValidationMode = "draft" | "submit"

/** Field-level validation for address section (draft = format-only; submit = full rules). */
export function validateAddressSection(
  input: {
    houseNo?: string
    locality: string
    colonyName: string
    city: string
    pinCode: string
  },
  tenant: AddressTenantContext & { configuredPostalCode?: string | null },
  mode: AddressValidationMode = "submit"
): Record<string, string[]> {
  const details: Record<string, string[]> = {}
  const strict = mode === "submit"

  if (strict && !input.locality) {
    details.locality = ["Locality name is required"]
  }
  if (strict && !input.colonyName) {
    details.colonyName = ["Colony name is required"]
  }

  if (input.pinCode) {
    if (!isValidPinFormat(input.pinCode)) {
      details.pinCode = ["PIN must be 6 digits, not starting with 0"]
    } else if (strict) {
      if (tenant.configuredPostalCode) {
        if (input.pinCode !== tenant.configuredPostalCode) {
          details.pinCode = [`PIN must be ${tenant.configuredPostalCode} for this ULB`]
        }
      } else {
        details.pinCode = ["Postal code is not configured for this ULB — contact your admin"]
      }
    }
  } else if (strict) {
    details.pinCode = ["PIN code is required"]
  }

  if (input.city && input.city !== tenant.cityName) {
    details.city = ["City must match the selected ULB"]
  }

  return details
}

export function addressTenantContext(
  muni: Doc<"municipalities">,
  district: Doc<"districts"> | null
): AddressTenantContext {
  return {
    districtId: muni.districtId,
    districtName: district?.name ?? "",
    municipalityId: muni._id,
    cityName: muni.name,
    postalCode: muni.postalCode ?? null,
  }
}

const RELATIONSHIP_SET = new Set<string>(RESPONDENT_RELATIONSHIP_VALUES)

export type OwnerEntry = {
  name?: string
  fatherOrHusbandName?: string
  mobileNo?: string
  altMobileNo?: string
}

export function isValidRespondentRelationship(value: string): boolean {
  return RELATIONSHIP_SET.has(value)
}

/** @deprecated Use `isValidIndianOwnerMobile` from `./ownerMobile`. */
export function isValidOwnerMobile(value: string): boolean {
  return isValidIndianOwnerMobile(value)
}

/** First owner row with an accepted mobile (primary contact for the survey). */
export function primaryOwnerMobile(owners: OwnerEntry[] | undefined, relationship?: string): string | undefined {
  return primaryOwnerMobileFromOwners(owners, relationship)
}

/** Drop blank rows; trim fields. */
export function normalizeOwners(owners: OwnerEntry[] | undefined): OwnerEntry[] | undefined {
  if (!owners?.length) return undefined
  const trimOpt = (s?: string) => {
    const t = s?.trim()
    return t ? t : undefined
  }
  const cleaned: OwnerEntry[] = []
  for (const o of owners) {
    const entry = {
      name: trimOpt(o.name),
      fatherOrHusbandName: trimOpt(o.fatherOrHusbandName),
      mobileNo: trimOpt(o.mobileNo),
      altMobileNo: trimOpt(o.altMobileNo),
    }
    if (entry.name || entry.fatherOrHusbandName || entry.mobileNo || entry.altMobileNo) {
      cleaned.push(entry)
    }
  }
  return cleaned.length ? cleaned : undefined
}

/** Field-level validation for owner section (merged into survey upsert / submit). */
export function validateOwnerSection(
  input: {
    relationship?: string
    owners?: OwnerEntry[]
  },
  options?: { requirePrimaryMobile?: boolean }
): Record<string, string[]> {
  const details: Record<string, string[]> = {}
  const requirePrimary = options?.requirePrimaryMobile ?? true
  if (input.relationship && !isValidRespondentRelationship(input.relationship)) {
    details.relationship = ["Select a valid relationship to owner"]
  }
  const owners = input.owners ?? []
  if (owners.length > MAX_SURVEY_OWNERS) {
    details.owners = [`At most ${MAX_SURVEY_OWNERS} owners allowed`]
  }
  const relationship = input.relationship?.trim()
  const firstMobile = owners[0]?.mobileNo?.trim() ?? ""
  if (requirePrimary && isRespondentOwner(relationship) && !isValidIndianOwnerMobile(firstMobile)) {
    details.mobileNo = ["Enter a valid 10-digit mobile for the owner (starts 6-9)"]
  } else if (firstMobile && !isValidIndianOwnerMobile(firstMobile)) {
    details.mobileNo = ["Enter a valid 10-digit mobile (starts 6-9)"]
  }
  owners.forEach((o, i) => {
    const mobile = o.mobileNo?.trim()
    if (mobile && !isValidIndianOwnerMobile(mobile)) {
      details[`owners.${i}.mobileNo`] = ["Enter a valid 10-digit mobile (starts 6-9)"]
    }
    const alt = o.altMobileNo?.trim()
    if (alt) {
      if (!isValidIndianOwnerMobile(alt)) {
        details[`owners.${i}.altMobileNo`] = ["Enter a valid 10-digit alternate mobile (starts 6-9)"]
      } else if (alt === mobile) {
        details[`owners.${i}.altMobileNo`] = ["Alternate mobile must differ from primary mobile"]
      }
    }
  })
  return details
}
