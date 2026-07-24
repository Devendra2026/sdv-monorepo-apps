/**
 * Survey edit lifecycle — who can write, how rows are resolved, and post-save status.
 *
 * Two independent axes:
 *  - `status`     — surveyor workflow (draft → submitted → approved)
 *  - `qcStatus`   — supervisor decision (pending → approved | rejected)
 *
 * QC rejection sets status back to draft while qcStatus stays rejected so the
 * surveyor can fix and resubmit. While a survey sits in the QC queue
 * (submitted + pending), both the assigned surveyor and supervisors may save
 * corrections without pulling it out of review.
 */
import { ConvexError } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { validateGps } from "../lib/gpsValidation"
import { validateServicesSection } from "../lib/masters/serviceMasters"
import { validateTaxationSection } from "../lib/masters/taxationMasters"
import { comparePropertyIds, compareWardThenParcel, resolvePropertyId } from "../lib/propertyId"
import { matchesSurveySearch } from "../lib/surveySearch"
import {
  isValidIndianOwnerMobile,
  normalizeOwners,
  primaryOwnerMobile,
  validateAddressSection,
  validateOwnerSection,
} from "../masters/helpers"
import { hasCapability } from "../shared/capabilities"
import { fieldSurveyAccess, isOwnScopeSurveyor } from "../shared/fieldAccess"
import { canReadWard, clientError } from "../shared/helpers"
import { assertMunicipalityInScope, resolveTenantScope } from "../shared/tenancy"
import { DRAFT_SURVEY_DEFAULTS } from "./validators"

/** Admin emergency edit — any survey state except when explicitly locked downstream. */
async function canAdminEmergencyEdit(ctx: MutationCtx, user: Doc<"users">): Promise<boolean> {
  if (user.role === "admin") return true
  return await hasCapability(ctx, user, "surveys.viewAll")
}

/** Gate draft saves — dynamic roles use `surveys.editDraft`; legacy supervisors may only have `qc.review`. */
export async function requireSurveyDraftEdit(ctx: MutationCtx, user: Doc<"users">): Promise<void> {
  const [canEditDraft, canQcReview] = await Promise.all([
    hasCapability(ctx, user, "surveys.editDraft"),
    hasCapability(ctx, user, "qc.review"),
  ])
  if (canEditDraft || canQcReview) return
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "You don't have permission for this action.",
  })
}

export async function assertSurveyWritable(ctx: MutationCtx, me: Doc<"users">, survey: Doc<"surveys">): Promise<void> {
  const [isAdmin, canQcReview, canEditDraft] = await Promise.all([
    canAdminEmergencyEdit(ctx, me),
    hasCapability(ctx, me, "qc.review"),
    hasCapability(ctx, me, "surveys.editDraft"),
  ])

  if (isAdmin) return

  if (survey.qcStatus === "approved") {
    clientError("LOCKED", "This survey is approved — contact an administrator to re-open it")
  }

  // In QC queue: only QC staff may correct data; field roles cannot edit after submit.
  if (survey.status === "submitted" && survey.qcStatus === "pending") {
    if (canQcReview) return
    clientError("LOCKED", "Survey is in QC review — only QC staff can edit until a decision is made")
  }

  // Draft / returned for correction — field surveyor or field supervisor & qc.review.
  if (survey.status === "draft") {
    const ownScope = await isOwnScopeSurveyor(ctx, me)
    if (ownScope && survey.surveyorId !== me._id) {
      clientError("FORBIDDEN", "Not your survey")
    }
    if (canEditDraft) return
    clientError("FORBIDDEN", "You don't have permission to edit this survey")
  }

  clientError("LOCKED", "This survey cannot be edited in its current state")
}

/** Status axes after a successful save — never implicitly resubmit or approve. */
export function resolvePostSaveStatuses(existing: Doc<"surveys">): Pick<Doc<"surveys">, "status" | "qcStatus"> {
  if (existing.qcStatus === "approved") {
    // Supervisor/admin edit re-queues for QC without changing the surveyor assignment.
    return { status: "submitted", qcStatus: "pending" }
  }

  if (existing.status === "submitted" && existing.qcStatus === "pending") {
    return { status: "submitted", qcStatus: "pending" }
  }

  if (existing.status === "draft" && existing.qcStatus === "rejected") {
    return { status: "draft", qcStatus: "rejected" }
  }

  if (existing.status === "submitted") {
    return { status: "submitted", qcStatus: existing.qcStatus }
  }

  if (existing.status === "approved") {
    return { status: "approved", qcStatus: existing.qcStatus }
  }

  return { status: "draft", qcStatus: existing.qcStatus }
}

export function auditActionForSave(existing: Doc<"surveys"> | null, isOwnScope: boolean, isNewDraft: boolean): string {
  if (!existing || isNewDraft) return isNewDraft ? "survey.created" : "survey.draft_saved"
  if (existing.status === "submitted" && existing.qcStatus === "pending") {
    return isOwnScope ? "survey.edited_in_review" : "survey.qc_corrected"
  }
  if (existing.status === "draft" && existing.qcStatus === "rejected") {
    return "survey.corrected"
  }
  if (existing.status === "draft") return "survey.draft_saved"
  return "survey.updated"
}

/**
 * Resolve the survey row being edited.
 *
 * Mobile surveyors sync via `localId`. Web editors (especially supervisors doing
 * QC corrections) must pass `id` so we don't create a duplicate row keyed to
 * the supervisor's surveyorId.
 */
export async function resolveExistingSurveyForSave(
  ctx: MutationCtx,
  me: Doc<"users">,
  args: { id?: Id<"surveys">; localId: string; municipalityId: Id<"municipalities"> }
): Promise<Doc<"surveys"> | null> {
  const ownScope = await isOwnScopeSurveyor(ctx, me)

  if (args.id) {
    const survey = await ctx.db.get(args.id)
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    await assertMunicipalityInScope(ctx, me, survey.municipalityId)
    if (ownScope && survey.surveyorId !== me._id) {
      clientError("FORBIDDEN", "Not your survey")
    }
    // Surveyors sync by localId; supervisors resolve by server id for QC corrections.
    if (ownScope && survey.localId !== args.localId) {
      clientError("BAD_REQUEST", "Survey identity mismatch")
    }
    return survey
  }

  if (ownScope) {
    // Never use .unique() here — concurrent first-insert races can create
    // duplicate (surveyorId, localId) rows; .unique() throws → UnhandledPromiseRejection
    // inside saveDraft's Promise.all → isolate restart.
    const rows = await ctx.db
      .query("surveys")
      .withIndex("by_surveyor_localId", (q) => q.eq("surveyorId", me._id).eq("localId", args.localId))
      .take(3)
    if (rows.length === 0) return null
    return rows.reduce((a, b) => (a._creationTime <= b._creationTime ? a : b))
  }

  // Supervisor/admin without explicit id — match by localId within the ULB.
  const matches = await ctx.db
    .query("surveys")
    .withIndex("by_municipality_localId", (q) =>
      q.eq("municipalityId", args.municipalityId).eq("localId", args.localId)
    )
    .take(3)
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) {
    clientError("BAD_REQUEST", "Multiple surveys share this local id — pass survey id")
  }
  return null
}

export async function loadMunicipalityCodes(
  ctx: QueryCtx,
  municipalityIds: Id<"municipalities">[]
): Promise<Map<Id<"municipalities">, string>> {
  const unique = [...new Set(municipalityIds)]
  const munis = await Promise.all(unique.map((id) => ctx.db.get(id)))
  const codes = new Map<Id<"municipalities">, string>()
  for (const m of munis) {
    if (m) codes.set(m._id, m.code)
  }
  return codes
}

export function enrichSurveyPropertyIds(
  rows: Doc<"surveys">[],
  codes: Map<Id<"municipalities">, string>
): Doc<"surveys">[] {
  return rows.map((row) => ({
    ...row,
    propertyId: resolvePropertyId(row, codes.get(row.municipalityId) ?? "") ?? row.propertyId,
  }))
}

export async function enrichSurveyorNames(
  ctx: QueryCtx,
  rows: Doc<"surveys">[]
): Promise<Array<Doc<"surveys"> & { surveyorName?: string }>> {
  const nameById = await loadSurveyorNameMap(ctx, rows)
  return rows.map((row) => ({
    ...row,
    surveyorName: nameById.get(row.surveyorId),
  }))
}

async function loadSurveyorNameMap(ctx: QueryCtx, rows: Doc<"surveys">[]): Promise<Map<Id<"users">, string>> {
  const surveyorIds = [...new Set(rows.map((r) => r.surveyorId))]
  const surveyors = await Promise.all(surveyorIds.map((id) => ctx.db.get("users", id)))
  const nameById = new Map<Id<"users">, string>()
  for (const s of surveyors) {
    if (s) nameById.set(s._id, s.name)
  }
  return nameById
}

export async function filterRowsBySearchTerm(
  ctx: QueryCtx,
  rows: Doc<"surveys">[],
  searchTerm: string
): Promise<Doc<"surveys">[]> {
  const searchCodes = await loadMunicipalityCodes(
    ctx,
    rows.map((r) => r.municipalityId)
  )
  const nameById = await loadSurveyorNameMap(ctx, rows)
  return rows.filter((row) =>
    matchesSurveySearch(
      { ...row, surveyorName: nameById.get(row.surveyorId) },
      searchTerm,
      searchCodes.get(row.municipalityId) ?? ""
    )
  )
}
/* ────────────────────────── internal ────────────────────────── */

export type SurveyUpsertArgs = {
  localId: string
  municipalityId: Id<"municipalities">
  clientUpdatedAt: number
  wardNo: string
  parcelNo: string
  unitNo: string
  mobileNo: string
  locality: string
  colonyName: string
  city: string
  pinCode: string
  assessmentYear: string
  ownershipType: string
  propertyType: string
  propertyUse: string
  situation: string
  roadType: string
  taxRateZone: string
  plotSqft: number
  plinthSqft: number
  isSlum: boolean
  municipalWaterConnection: boolean
  waterSource: Doc<"surveys">["waterSource"]
  sanitationType: Doc<"surveys">["sanitationType"]
  municipalWasteCollection: boolean
  sectorNo?: string
  oldPropertyNo?: string
  propertyId?: string
  constructedYear?: number
  respondentName?: string
  relationship?: string
  owners?: Doc<"surveys">["owners"]
  familySize?: number
  altMobileNo?: string
  houseNo?: string
  electricityNo?: string
  gps?: Doc<"surveys">["gps"]
  street?: string
}

export function normalizePropertyFields<
  T extends {
    parcelNo?: string
    unitNo?: string
    sectorNo?: string
    oldPropertyNo?: string
    propertyId?: string
    constructedYear?: number
  },
>(args: T): T {
  return {
    ...args,
    sectorNo: args.sectorNo?.trim() || undefined,
    oldPropertyNo: args.oldPropertyNo?.trim() || undefined,
    propertyId: args.propertyId?.trim() || undefined,
    parcelNo: (args.parcelNo ?? "").trim(),
    unitNo: (args.unitNo ?? "").trim(),
    constructedYear: args.constructedYear,
  }
}

export function withResolvedPropertyId<
  T extends {
    propertyId?: string
    wardNo?: string
    parcelNo?: string
    unitNo?: string
    propertyUse?: string
  },
>(args: T, ulbCode: string): T {
  return {
    ...args,
    propertyId: resolvePropertyId(args, ulbCode),
  }
}

export function normalizeOwnerFields<
  T extends {
    mobileNo?: string
    altMobileNo?: string
    respondentName?: string
    relationship?: string
    owners?: Doc<"surveys">["owners"]
    familySize?: number
  },
>(args: T): T {
  const trimOpt = (s?: string) => {
    const t = s?.trim()
    return t ? t : undefined
  }
  const owners = normalizeOwners(args.owners as Parameters<typeof normalizeOwners>[0])
  const relationship = trimOpt(args.relationship as string | undefined)
  const mobileNo = primaryOwnerMobile(owners, relationship) ?? trimOpt(args.mobileNo as string | undefined) ?? ""
  const altMobileNo = owners?.[0]?.altMobileNo ?? trimOpt(args.altMobileNo as string | undefined)
  return {
    ...args,
    respondentName: trimOpt(args.respondentName as string | undefined),
    relationship,
    owners,
    mobileNo,
    altMobileNo,
    familySize: args.familySize as number | undefined,
  }
}

/** Remove mutation-only / non-schema keys before writing to the `surveys` table. */
export function stripLocalId<T extends { localId: string; id?: Id<"surveys">; surveyorId?: Id<"users"> }>(
  args: T
): Omit<T, "localId" | "id" | "street"> {
  const { localId, id, ...rest } = args as T & { street?: unknown }
  void localId
  void id
  if ("street" in rest) {
    delete (rest as { street?: unknown }).street
  }
  return rest as Omit<T, "localId" | "id" | "street">
}

/**
 * Partial patch: only fields that differ from `existing`, plus required meta.
 * Cuts write amplification and same-document OCC on hot draft autosaves.
 */
export function buildSurveyPartialPatch(
  existing: Doc<"surveys">,
  writable: Record<string, unknown>,
  meta: {
    status: Doc<"surveys">["status"]
    qcStatus: Doc<"surveys">["qcStatus"]
    clientUpdatedAt: number
    completionPct: number | undefined
  }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(writable)) {
    if (key.startsWith("_")) continue
    const prev = existing[key as keyof Doc<"surveys">]
    if (surveyFieldEqual(prev, value)) continue
    patch[key] = value
  }
  if (existing.status !== meta.status) patch.status = meta.status
  if (existing.qcStatus !== meta.qcStatus) patch.qcStatus = meta.qcStatus
  if (existing.clientUpdatedAt !== meta.clientUpdatedAt) patch.clientUpdatedAt = meta.clientUpdatedAt
  if (existing.completionPct !== meta.completionPct) patch.completionPct = meta.completionPct

  // Always bump version when anything else changed (or client clock advanced).
  if (Object.keys(patch).length > 0 || existing.clientUpdatedAt !== meta.clientUpdatedAt) {
    patch.serverVersion = existing.serverVersion + 1
    patch.clientUpdatedAt = meta.clientUpdatedAt
  }
  return patch
}

function surveyFieldEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === undefined && b === undefined) return true
  if (a === null && b === null) return true
  if (typeof a !== typeof b) return false
  if (typeof a === "object" && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return false
}

type DraftMutationArgs = {
  id?: Id<"surveys">
  localId: string
  municipalityId: Id<"municipalities">
  clientUpdatedAt: number
  wardNo?: string
  [key: string]: unknown
}

export function mergeDraftArgs(
  existing: Doc<"surveys"> | null,
  patch: DraftMutationArgs,
  muni: Doc<"municipalities">
): SurveyUpsertArgs {
  const base: SurveyUpsertArgs = existing
    ? {
        localId: patch.localId,
        municipalityId: patch.municipalityId,
        clientUpdatedAt: patch.clientUpdatedAt,
        wardNo: existing.wardNo,
        sectorNo: existing.sectorNo,
        oldPropertyNo: existing.oldPropertyNo,
        propertyId: existing.propertyId,
        parcelNo: existing.parcelNo,
        unitNo: existing.unitNo,
        constructedYear: existing.constructedYear,
        isSlum: existing.isSlum,
        respondentName: existing.respondentName,
        relationship: existing.relationship,
        owners: existing.owners,
        familySize: existing.familySize,
        mobileNo: existing.mobileNo,
        altMobileNo: existing.altMobileNo,
        houseNo: existing.houseNo,
        locality: existing.locality,
        colonyName: existing.colonyName,
        pinCode: existing.pinCode,
        city: existing.city,
        assessmentYear: existing.assessmentYear,
        ownershipType: existing.ownershipType,
        propertyType: existing.propertyType,
        propertyUse: existing.propertyUse,
        situation: existing.situation,
        roadType: existing.roadType,
        taxRateZone: existing.taxRateZone,
        plotSqft: existing.plotSqft,
        plinthSqft: existing.plinthSqft,
        municipalWaterConnection: existing.municipalWaterConnection,
        waterSource: existing.waterSource,
        sanitationType: existing.sanitationType,
        municipalWasteCollection: existing.municipalWasteCollection,
        electricityNo: existing.electricityNo,
        gps: existing.gps,
      }
    : {
        localId: patch.localId,
        municipalityId: patch.municipalityId,
        clientUpdatedAt: patch.clientUpdatedAt,
        ...DRAFT_SURVEY_DEFAULTS,
        city: muni.name,
      }

  const { localId, municipalityId, clientUpdatedAt, id, ...fields } = patch
  void localId
  void municipalityId
  void clientUpdatedAt
  void id
  return { ...base, ...pickDefined(fields) }
}

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T]
  }
  return out
}

export function validateBusinessRules(
  in_: Record<string, unknown>,
  addressCtx: Parameters<typeof validateAddressSection>[1],
  mode: "draft" | "submit" = "submit",
  options?: { allowedTaxZones?: Set<string> }
): void {
  const details: Record<string, string[]> = {}
  const strict = mode === "submit"

  Object.assign(
    details,
    validateOwnerSection(
      {
        relationship: in_.relationship as string | undefined,
        owners: in_.owners as Parameters<typeof validateOwnerSection>[0]["owners"],
      },
      { requirePrimaryMobile: strict }
    )
  )
  const denormalizedMobile = String(in_.mobileNo ?? "").trim()
  if (denormalizedMobile && !isValidIndianOwnerMobile(denormalizedMobile)) {
    details.mobileNo = ["Enter a valid 10-digit mobile (starts 6-9)"]
  }
  Object.assign(
    details,
    validateAddressSection(
      {
        houseNo: in_.houseNo as string | undefined,
        locality: in_.locality as string,
        colonyName: in_.colonyName as string,
        city: in_.city as string,
        pinCode: in_.pinCode as string,
      },
      addressCtx,
      mode
    )
  )
  const plot = in_.plotSqft as unknown as number
  const plinth = in_.plinthSqft as unknown as number
  if (typeof plot === "number" && typeof plinth === "number" && plinth > plot && plot > 0) {
    details.plinthSqft = ["Plinth area cannot exceed plot area"]
  }
  const familySize = in_.familySize as unknown as number | undefined
  if (familySize != null && (familySize < 1 || !Number.isInteger(familySize))) {
    details.familySize = ["Family size must be a whole number ≥ 1"]
  }

  const parcelNo = String(in_.parcelNo ?? "").trim()
  if (strict && !parcelNo) {
    details.parcelNo = ["Parcel number is required"]
  }
  const unitNo = String(in_.unitNo ?? "").trim()
  if (strict && !unitNo) {
    details.unitNo = ["Unit number is required"]
  }
  if (strict && !String(in_.assessmentYear ?? "").trim()) {
    details.assessmentYear = ["Assessment year is required"]
  }
  Object.assign(
    details,
    validateTaxationSection(
      {
        ownershipType: in_.ownershipType as string | undefined,
        propertyUse: in_.propertyUse as string | undefined,
        propertyType: in_.propertyType as string | undefined,
        situation: in_.situation as string | undefined,
        roadType: in_.roadType as string | undefined,
        taxRateZone: in_.taxRateZone as string | undefined,
      },
      mode,
      options
    )
  )
  Object.assign(
    details,
    validateServicesSection(
      {
        municipalWaterConnection: in_.municipalWaterConnection as boolean | undefined,
        waterSource: in_.waterSource as string | undefined,
        sanitationType: in_.sanitationType as string | undefined,
        municipalWasteCollection: in_.municipalWasteCollection as boolean | undefined,
      },
      mode
    )
  )
  const constructedYear = in_.constructedYear as unknown as number | undefined
  if (constructedYear != null) {
    const currentYear = new Date().getFullYear()
    if (!Number.isInteger(constructedYear) || constructedYear < 1800 || constructedYear > currentYear) {
      details.constructedYear = [`Enter a year between 1800 and ${currentYear}`]
    }
  }
  if (in_.gps) {
    const gpsMessage = validateGps(in_.gps as NonNullable<Doc<"surveys">["gps"]>, {
      strict,
    })
    if (gpsMessage) {
      details.gps = [gpsMessage]
    }
  }
  if (Object.keys(details).length > 0) {
    throw new ConvexError({
      code: "VALIDATION",
      message: "Business rule violation",
      details,
    })
  }
}

export function resolveListSort(args: {
  status?: Doc<"surveys">["status"]
  sortBy?: "propertyId" | "updated"
}): "propertyId" | "updated" {
  if (args.sortBy) return args.sortBy
  if (args.status === "draft") return "updated"
  return "propertyId"
}

export function sortSurveyRows(rows: Doc<"surveys">[], sortBy: "propertyId" | "updated"): Doc<"surveys">[] {
  if (sortBy === "updated") {
    return [...rows].sort((a, b) => b.clientUpdatedAt - a.clientUpdatedAt)
  }
  return [...rows].sort((a, b) => comparePropertyIds(a.propertyId, b.propertyId))
}

export function wardNumbersMatch(rowWard: string, filterWard: string): boolean {
  if (rowWard === filterWard) return true
  const a = Number(rowWard)
  const b = Number(filterWard)
  return !Number.isNaN(a) && !Number.isNaN(b) && a === b
}

export function applySurveyListFilters(
  rows: Doc<"surveys">[],
  args: {
    status?: Doc<"surveys">["status"]
    qcStatus?: Doc<"surveys">["qcStatus"]
    qcStatuses?: Doc<"surveys">["qcStatus"][]
    wardNo?: string
    districtId?: Id<"districts">
    municipalityId?: Id<"municipalities">
    surveyorId?: Id<"users">
    fromMs?: number
    toMs?: number
    sortBy?: "propertyId" | "updated"
  },
  me: Doc<"users">,
  muniIds: Set<Id<"municipalities">>
): Doc<"surveys">[] {
  let filtered = rows.filter((r) => muniIds.has(r.municipalityId) && canReadWard(me, r.municipalityId, r.wardNo))
  if (args.districtId) filtered = filtered.filter((r) => r.districtId === args.districtId)
  if (args.municipalityId) filtered = filtered.filter((r) => r.municipalityId === args.municipalityId)
  if (args.surveyorId) filtered = filtered.filter((r) => r.surveyorId === args.surveyorId)
  if (args.status) {
    filtered = filtered.filter((r) => r.status === args.status)
  }
  if (args.qcStatus) filtered = filtered.filter((r) => r.qcStatus === args.qcStatus)
  if (args.qcStatuses && args.qcStatuses.length > 0) {
    const allowed = new Set(args.qcStatuses)
    filtered = filtered.filter((r) => {
      if (!allowed.has(r.qcStatus)) return false
      if (r.qcStatus === "pending" && r.status !== "submitted") return false
      return true
    })
  }
  if (args.wardNo) filtered = filtered.filter((r) => wardNumbersMatch(r.wardNo, args.wardNo!))
  if (args.fromMs !== undefined) filtered = filtered.filter((r) => r._creationTime >= args.fromMs!)
  if (args.toMs !== undefined) filtered = filtered.filter((r) => r._creationTime <= args.toMs!)
  const sortBy = resolveListSort(args)
  if (sortBy === "updated") {
    return filtered.sort((a, b) => b.clientUpdatedAt - a.clientUpdatedAt)
  }
  return filtered.sort(compareWardThenParcel)
}

/**
 * Max rows loaded for expensive listPaginated filter paths (search, date range, multi-QC, parcelShared).
 *
 * Before: 5000 — full-scan paths caused SystemTimeout / 503.
 * After: 800 — still useful pages; `scopeTruncated` signals incompleteness.
 */
export const LIST_PAGINATED_SCOPE_LIMIT = 800
export const LIST_PAGINATED_PAGE_BUFFER = 100
/**
 * Max survey rows for command-center live fallback (date/status/QC filters).
 *
 * Before: 2500 — multi-ULB live scans caused SystemTimeout / 503.
 * After: 800 — same budget as listPaginated; rollup fast-path unchanged.
 */
export const COMMAND_CENTER_WARD_SCAN_LIMIT = 800

/**
 * Max municipalities for parallel survey fan-out in list/export collect paths.
 * Aligns with dashboard analytics fan-out — prevents admin scopes from saturating Postgres.
 */
export const LIST_FANOUT_ULB_CAP = 12

export type SurveyListFilterArgs = {
  status?: Doc<"surveys">["status"]
  qcStatus?: Doc<"surveys">["qcStatus"]
  qcStatuses?: Doc<"surveys">["qcStatus"][]
  wardNo?: string
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  surveyorId?: Id<"users">
  fromMs?: number
  toMs?: number
  searchTerm?: string
  parcelSharedOnly?: boolean
  sortBy?: "propertyId" | "updated"
}

export function listPaginatedRequiresFullScan(args: SurveyListFilterArgs): boolean {
  return Boolean(
    args.searchTerm?.trim() ||
    args.parcelSharedOnly ||
    args.fromMs !== undefined ||
    args.toMs !== undefined ||
    (args.qcStatuses && args.qcStatuses.length > 0)
  )
}

/** True when a single-ULB updated sort can use index order + take instead of a wide collect. */
export function listPaginatedUsesIndexedTake(args: SurveyListFilterArgs): boolean {
  return Boolean(
    args.municipalityId && !listPaginatedRequiresFullScan(args) && !args.wardNo && resolveListSort(args) === "updated"
  )
}

/**
 * True when list/export can walk the full ULB (or ward) via Convex `.paginate()`
 * instead of an offset window over a capped collect.
 */
export function listPaginatedUsesIndexedCursor(args: SurveyListFilterArgs): boolean {
  return Boolean(args.municipalityId && !listPaginatedRequiresFullScan(args) && !args.surveyorId)
}

/** Prefix for ward-variant cursor payloads (JSON after prefix). */
export const INDEXED_LIST_CURSOR_PREFIX = "ic1:"

export function resolveListPaginatedScanLimit(options: {
  offset: number
  numItems: number
  statsTotal: number | null
  requiresFullScan: boolean
}): number {
  const needed = options.offset + options.numItems + LIST_PAGINATED_PAGE_BUFFER
  if (options.requiresFullScan) {
    return LIST_PAGINATED_SCOPE_LIMIT
  }
  if (options.statsTotal !== null) {
    return Math.min(LIST_PAGINATED_SCOPE_LIMIT, needed)
  }
  return Math.min(LIST_PAGINATED_SCOPE_LIMIT, needed)
}

export function parseListOffset(cursor: string | null | undefined): number {
  if (!cursor) return 0
  // Indexed / Convex cursors are opaque — never treat them as numeric offsets.
  if (cursor.startsWith(INDEXED_LIST_CURSOR_PREFIX)) return 0
  const n = Number(cursor)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

/** Common wardNo spellings so "5" / "05" / "005" each get their own index pages. */
export function wardNoSpellingVariants(wardNo: string): string[] {
  const trimmed = wardNo.trim()
  const wardSet = new Set<string>()
  if (trimmed) wardSet.add(trimmed)
  const wardNum = Number(trimmed)
  if (!Number.isNaN(wardNum)) {
    wardSet.add(String(wardNum))
    wardSet.add(String(wardNum).padStart(2, "0"))
    wardSet.add(String(wardNum).padStart(3, "0"))
  }
  return [...wardSet].filter((w) => w.length > 0)
}

/** Resolve a ward master row allowing numeric spelling variants ("1" ↔ "01"). */
export async function findWardForMunicipality(
  ctx: QueryCtx | MutationCtx,
  municipalityId: Id<"municipalities">,
  wardNo: string
): Promise<Doc<"wards"> | null> {
  for (const variant of wardNoSpellingVariants(wardNo)) {
    const rows = await ctx.db
      .query("wards")
      .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", municipalityId).eq("wardNo", variant))
      .take(1)
    if (rows[0]) return rows[0]
  }
  return null
}

type WardIndexedCursor = { w: number; c: string | null }

function encodeWardIndexedCursor(state: WardIndexedCursor): string {
  return `${INDEXED_LIST_CURSOR_PREFIX}${JSON.stringify({ w: state.w, c: state.c })}`
}

function decodeWardIndexedCursor(cursor: string | null | undefined): WardIndexedCursor {
  if (!cursor) return { w: 0, c: null }
  if (!cursor.startsWith(INDEXED_LIST_CURSOR_PREFIX)) {
    // Legacy offset cursors ("20") are not valid Convex paginate cursors.
    if (/^\d+$/.test(cursor)) return { w: 0, c: null }
    return { w: 0, c: cursor }
  }
  try {
    const parsed = JSON.parse(cursor.slice(INDEXED_LIST_CURSOR_PREFIX.length)) as {
      w?: unknown
      c?: unknown
    }
    const w = typeof parsed.w === "number" && Number.isFinite(parsed.w) ? Math.max(0, Math.floor(parsed.w)) : 0
    const c = typeof parsed.c === "string" ? parsed.c : null
    return { w, c }
  } catch {
    return { w: 0, c: null }
  }
}

/** Drop legacy numeric offsets / ward-encoded cursors that are invalid for plain Convex paginate. */
export function sanitizeConvexPaginateCursor(cursor: string | null | undefined): string | null {
  if (!cursor) return null
  if (cursor.startsWith(INDEXED_LIST_CURSOR_PREFIX)) return null
  if (/^\d+$/.test(cursor)) return null
  return cursor
}

async function paginateWardVariant(
  ctx: QueryCtx,
  municipalityId: Id<"municipalities">,
  ward: string,
  status: Doc<"surveys">["status"] | undefined,
  paginationOpts: { numItems: number; cursor: string | null }
) {
  if (status) {
    return await ctx.db
      .query("surveys")
      .withIndex("by_municipality_ward_status", (q) =>
        q.eq("municipalityId", municipalityId).eq("wardNo", ward).eq("status", status)
      )
      .order("desc")
      .paginate(paginationOpts)
  }
  return await ctx.db
    .query("surveys")
    .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", municipalityId).eq("wardNo", ward))
    .order("desc")
    .paginate(paginationOpts)
}

/**
 * Index-backed Convex cursor pagination for a single municipality (optional ward).
 * At most ONE `.paginate()` call per invocation (Convex rule).
 * Ward spelling variants advance via encoded cursors across separate requests.
 */
export async function paginateMunicipalitySurveys(
  ctx: QueryCtx,
  args: {
    municipalityId: Id<"municipalities">
    status?: Doc<"surveys">["status"]
    qcStatus?: Doc<"surveys">["qcStatus"]
    wardNo?: string
    paginationOpts: { numItems: number; cursor: string | null }
  }
): Promise<{ page: Doc<"surveys">[]; continueCursor: string | null; isDone: boolean }> {
  const numItems = args.paginationOpts.numItems
  const rawCursor = args.paginationOpts.cursor

  if (args.wardNo) {
    const variants = wardNoSpellingVariants(args.wardNo)
    const { w, c } = decodeWardIndexedCursor(rawCursor)
    if (w >= variants.length) {
      return { page: [], continueCursor: null, isDone: true }
    }

    const variant = variants[w]!
    const result = await paginateWardVariant(ctx, args.municipalityId, variant, args.status, {
      numItems,
      cursor: c,
    })

    if (!result.isDone) {
      return {
        page: result.page,
        continueCursor: encodeWardIndexedCursor({ w, c: result.continueCursor }),
        isDone: false,
      }
    }

    // This spelling is exhausted — hand the client the next variant (no second paginate here).
    const nextW = w + 1
    if (nextW >= variants.length) {
      return {
        page: result.page,
        continueCursor: null,
        isDone: true,
      }
    }
    return {
      page: result.page,
      continueCursor: encodeWardIndexedCursor({ w: nextW, c: null }),
      isDone: false,
    }
  }

  const cursor = sanitizeConvexPaginateCursor(rawCursor)

  if (args.qcStatus) {
    const result = await ctx.db
      .query("surveys")
      .withIndex("by_municipality_qc_status", (q) =>
        q.eq("municipalityId", args.municipalityId).eq("qcStatus", args.qcStatus!)
      )
      .order("desc")
      .paginate({ numItems, cursor })
    return {
      page: result.page,
      continueCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    }
  }

  if (args.status) {
    const result = await ctx.db
      .query("surveys")
      .withIndex("by_municipality_status", (q) =>
        q.eq("municipalityId", args.municipalityId).eq("status", args.status!)
      )
      .order("desc")
      .paginate({ numItems, cursor })
    return {
      page: result.page,
      continueCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    }
  }

  const result = await ctx.db
    .query("surveys")
    .withIndex("by_municipality_status", (q) => q.eq("municipalityId", args.municipalityId))
    .order("desc")
    .paginate({ numItems, cursor })
  return {
    page: result.page,
    continueCursor: result.isDone ? null : result.continueCursor,
    isDone: result.isDone,
  }
}

async function querySurveysByMunicipality(
  ctx: QueryCtx,
  municipalityId: Id<"municipalities">,
  status?: Doc<"surveys">["status"],
  maxRows = LIST_PAGINATED_SCOPE_LIMIT
): Promise<Doc<"surveys">[]> {
  if (status) {
    return ctx.db
      .query("surveys")
      .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId).eq("status", status))
      .take(maxRows)
  }
  return ctx.db
    .query("surveys")
    .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId))
    .take(maxRows)
}

async function querySurveysByDistrict(
  ctx: QueryCtx,
  districtId: Id<"districts">,
  status?: Doc<"surveys">["status"],
  maxRows = LIST_PAGINATED_SCOPE_LIMIT
): Promise<Doc<"surveys">[]> {
  if (status) {
    return ctx.db
      .query("surveys")
      .withIndex("by_district_status", (q) => q.eq("districtId", districtId).eq("status", status))
      .take(maxRows)
  }
  return ctx.db
    .query("surveys")
    .withIndex("by_district_status", (q) => q.eq("districtId", districtId))
    .take(maxRows)
}

/** Load rows matching list filters using indexes, then scope + filter in memory. */
export async function collectSurveysForListPaginated(
  ctx: QueryCtx,
  me: Doc<"users">,
  args: SurveyListFilterArgs,
  scope: Awaited<ReturnType<typeof resolveTenantScope>>,
  muniIds: Set<Id<"municipalities">>,
  access: Awaited<ReturnType<typeof fieldSurveyAccess>>,
  maxRows = LIST_PAGINATED_SCOPE_LIMIT
): Promise<Doc<"surveys">[]> {
  let rows: Doc<"surveys">[] = []

  if (args.qcStatus) {
    if (args.municipalityId) {
      rows = await ctx.db
        .query("surveys")
        .withIndex("by_municipality_qc_status", (q) =>
          q.eq("municipalityId", args.municipalityId!).eq("qcStatus", args.qcStatus!)
        )
        .take(maxRows)
    } else if (args.districtId) {
      rows = await ctx.db
        .query("surveys")
        .withIndex("by_district_qc_status", (q) => q.eq("districtId", args.districtId!).eq("qcStatus", args.qcStatus!))
        .take(maxRows)
    } else {
      const scopedMunis =
        scope.municipalities.length > 0
          ? scope.municipalities.map((m) => m._id)
          : access === "assigned" && me.municipalityId
            ? [me.municipalityId]
            : [...muniIds]
      if (scopedMunis.length > 0) {
        const targetMunis = scopedMunis.slice(0, LIST_FANOUT_ULB_CAP)
        const perMuniCap = Math.max(50, Math.ceil(maxRows / targetMunis.length))
        const batches = await Promise.all(
          targetMunis.map((municipalityId) =>
            ctx.db
              .query("surveys")
              .withIndex("by_municipality_qc_status", (q) =>
                q.eq("municipalityId", municipalityId).eq("qcStatus", args.qcStatus!)
              )
              .take(perMuniCap)
          )
        )
        const seen = new Set<string>()
        for (const batch of batches) {
          for (const row of batch) {
            if (seen.has(row._id)) continue
            seen.add(row._id)
            rows.push(row)
          }
        }
      } else {
        // Never scan global by_qc_status — require municipality/district scope.
        rows = []
      }
    }
  } else if (access === "own") {
    rows = await ctx.db
      .query("surveys")
      .withIndex("by_surveyor", (q) => q.eq("surveyorId", me._id))
      .order("desc")
      .take(maxRows)
  } else if (args.wardNo && args.municipalityId) {
    // Prefer ward-scoped indexes; load common wardNo spellings (5 / 05 / 005).
    const wardSet = new Set([args.wardNo.trim()])
    const wardNum = Number(args.wardNo)
    if (!Number.isNaN(wardNum)) {
      wardSet.add(String(wardNum))
      wardSet.add(String(wardNum).padStart(2, "0"))
      wardSet.add(String(wardNum).padStart(3, "0"))
    }
    const wardList = [...wardSet].filter((w) => w.length > 0)
    const perWardCap = Math.max(50, Math.ceil(maxRows / Math.max(wardList.length, 1)))
    const batches = await Promise.all(
      wardList.map((ward) =>
        args.status
          ? ctx.db
              .query("surveys")
              .withIndex("by_municipality_ward_status", (q) =>
                q.eq("municipalityId", args.municipalityId!).eq("wardNo", ward).eq("status", args.status!)
              )
              .take(perWardCap)
          : ctx.db
              .query("surveys")
              .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", args.municipalityId!).eq("wardNo", ward))
              .take(perWardCap)
      )
    )
    const seen = new Set<string>()
    for (const batch of batches) {
      for (const row of batch) {
        if (seen.has(row._id)) continue
        seen.add(row._id)
        rows.push(row)
        if (rows.length >= maxRows) break
      }
      if (rows.length >= maxRows) break
    }
  } else if (args.municipalityId) {
    rows = await querySurveysByMunicipality(ctx, args.municipalityId, args.status, maxRows)
  } else if (args.districtId) {
    rows = await querySurveysByDistrict(ctx, args.districtId, args.status, maxRows)
  } else if (args.surveyorId) {
    rows = await ctx.db
      .query("surveys")
      .withIndex("by_surveyor", (q) => q.eq("surveyorId", args.surveyorId!))
      .order("desc")
      .take(maxRows)
  } else if (access === "assigned") {
    const scopedMunis = scope.municipalities.map((m) => m._id).slice(0, LIST_FANOUT_ULB_CAP)
    if (scopedMunis.length > 1) {
      const perMuniCap = Math.max(50, Math.ceil(maxRows / scopedMunis.length))
      const batches = await Promise.all(
        scopedMunis.map((municipalityId) => querySurveysByMunicipality(ctx, municipalityId, args.status, perMuniCap))
      )
      const seen = new Set<string>()
      for (const batch of batches) {
        for (const row of batch) {
          if (seen.has(row._id)) continue
          seen.add(row._id)
          rows.push(row)
        }
      }
    } else if (scopedMunis.length === 1) {
      rows = await querySurveysByMunicipality(ctx, scopedMunis[0]!, args.status, maxRows)
    } else if (scope.districts.length === 1) {
      rows = await querySurveysByDistrict(ctx, scope.districts[0]!._id, args.status, maxRows)
    }
  } else {
    const scopedMunis = (
      scope.municipalities.length > 0
        ? scope.municipalities.map((m) => m._id)
        : access === "admin"
          ? [...muniIds]
          : me.municipalityId
            ? [me.municipalityId]
            : []
    ).slice(0, LIST_FANOUT_ULB_CAP)
    if (scopedMunis.length > 0) {
      const perMuniCap = Math.max(50, Math.ceil(maxRows / scopedMunis.length))
      const batches = await Promise.all(
        scopedMunis.map((municipalityId) => querySurveysByMunicipality(ctx, municipalityId, args.status, perMuniCap))
      )
      const seen = new Set<string>()
      for (const batch of batches) {
        for (const row of batch) {
          if (seen.has(row._id)) continue
          seen.add(row._id)
          rows.push(row)
        }
      }
    }
  }

  return applySurveyListFilters(rows, args, me, muniIds)
}
