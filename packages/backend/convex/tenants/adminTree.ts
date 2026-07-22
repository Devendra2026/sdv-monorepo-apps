/**
 * Pure helpers for the admin tenant tree (districts → ULBs → wards).
 * Keeps projection/sorting out of the Convex handler so isolate work stays small.
 */
import type { Id } from "../_generated/dataModel"

export type AdminDistrictInput = {
  _id: Id<"districts">
  code: string
  name: string
  stateName: string
  isActive: boolean
}

export type AdminUlbInput = {
  _id: Id<"municipalities">
  districtId: Id<"districts">
  code: string
  name: string
  bodyType: "municipal_council" | "town_panchayat"
  postalCode?: string
  isActive: boolean
  /** Intentionally omitted from projected output — large / unused on admin tree screens. */
  executiveSignatureStorageId?: Id<"_storage">
}

export type AdminWardInput = {
  _id: Id<"wards">
  municipalityId: Id<"municipalities">
  wardNo: string
  wardCode: string
  name: string
}

export type AdminWardNode = {
  _id: Id<"wards">
  municipalityId: Id<"municipalities">
  wardNo: string
  wardCode: string
  name: string
}

export type AdminUlbNode = {
  _id: Id<"municipalities">
  districtId: Id<"districts">
  code: string
  name: string
  bodyType: "municipal_council" | "town_panchayat"
  postalCode?: string
  isActive: boolean
  wards: AdminWardNode[]
}

export type AdminDistrictNode = {
  _id: Id<"districts">
  code: string
  name: string
  stateName: string
  isActive: boolean
  ulbs: AdminUlbNode[]
}

export function compareWardNo(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}

function projectWard(w: AdminWardInput): AdminWardNode {
  return {
    _id: w._id,
    municipalityId: w.municipalityId,
    wardNo: w.wardNo,
    wardCode: w.wardCode,
    name: w.name,
  }
}

function projectUlb(m: AdminUlbInput, wards: AdminWardNode[]): AdminUlbNode {
  const node: AdminUlbNode = {
    _id: m._id,
    districtId: m.districtId,
    code: m.code,
    name: m.name,
    bodyType: m.bodyType,
    isActive: m.isActive,
    wards,
  }
  if (m.postalCode !== undefined) node.postalCode = m.postalCode
  return node
}

/** Build sorted admin tree from already-loaded rows (no DB I/O). */
export function buildAdminTenantTree(
  districts: AdminDistrictInput[],
  municipalities: AdminUlbInput[],
  wards: AdminWardInput[]
): AdminDistrictNode[] {
  const wardsByMuni = new Map<Id<"municipalities">, AdminWardNode[]>()
  for (const w of wards) {
    const list = wardsByMuni.get(w.municipalityId) ?? []
    list.push(projectWard(w))
    wardsByMuni.set(w.municipalityId, list)
  }
  for (const list of wardsByMuni.values()) {
    list.sort((a, b) => compareWardNo(a.wardNo, b.wardNo))
  }

  const ulbsByDistrict = new Map<Id<"districts">, AdminUlbNode[]>()
  for (const m of municipalities) {
    const list = ulbsByDistrict.get(m.districtId) ?? []
    list.push(projectUlb(m, wardsByMuni.get(m._id) ?? []))
    ulbsByDistrict.set(m.districtId, list)
  }
  for (const list of ulbsByDistrict.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }

  return [...districts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({
      _id: d._id,
      code: d.code,
      name: d.name,
      stateName: d.stateName,
      isActive: d.isActive,
      ulbs: ulbsByDistrict.get(d._id) ?? [],
    }))
}
