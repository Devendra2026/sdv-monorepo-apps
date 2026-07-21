import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { normalizeFloorFields, usageTypeToOccupied, validateFloorRow } from "../lib/masters/areaMasters"
import { lookupSurveyByPropertyId } from "../lib/propertyIdLookup"
import { recordSurveyStatsInsert, recordSurveyStatsUpdate } from "../lib/surveyScopeStats"
import { normalizeAddressFields } from "../masters/helpers"
import { assertCanReadWard, clientError } from "../shared/helpers"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { assertMunicipalityInScope } from "../shared/tenancy"
import {
  assertSurveyWritable,
  mergeDraftArgs,
  normalizeOwnerFields,
  normalizePropertyFields,
  stripLocalId,
  withResolvedPropertyId,
  type SurveyUpsertArgs,
} from "../surveys/helpers"
import { registerPropertyIdMapping } from "./helpers"

export type ImportSurveyRow = {
  localId: string
  municipalityId: Id<"municipalities">
  wardNo: string
  propertyId?: string
  sectorNo?: string
  oldPropertyNo?: string
  parcelNo: string
  unitNo: string
  constructedYear?: number
  isSlum?: boolean
  respondentName?: string
  relationship?: string
  familySize?: number
  mobileNo?: string
  altMobileNo?: string
  houseNo?: string
  locality?: string
  colonyName?: string
  city?: string
  pinCode?: string
  assessmentYear?: string
  ownershipType?: string
  propertyType?: string
  propertyUse?: string
  situation?: string
  roadType?: string
  taxRateZone?: string
  plotSqft?: number
  plinthSqft?: number
  municipalWaterConnection?: boolean
  waterSource?: string
  sanitationType?: string
  municipalWasteCollection?: boolean
  electricityNo?: string
  owners?: Array<{
    name?: string
    fatherOrHusbandName?: string
    mobileNo?: string
    altMobileNo?: string
  }>
}

export type ImportFloorRow = {
  propertyId: string
  clientFloorId: string
  position: number
  floorName: string
  usageFactor?: string
  usageType: string
  constructionType: string
  isOccupied?: boolean
  areaSqft: number
}

export type ImportSurveyRowError = {
  propertyId?: string
  localId?: string
  message: string
}

type ImportSurveyPlan =
  | { kind: "error"; error: ImportSurveyRowError }
  | {
      kind: "ready"
      localId: string
      existing: Doc<"surveys"> | null
      normalized: SurveyUpsertArgs
      writable: Record<string, unknown>
      pid: string | undefined
    }

/** Resolve and validate one survey import row without writing. */
export async function planExcelSurveyImport(
  ctx: MutationCtx,
  me: Doc<"users">,
  row: ImportSurveyRow,
): Promise<ImportSurveyPlan> {
  try {
    const muni = await ctx.db.get(row.municipalityId)
    if (!muni) {
      return { kind: "error", error: { localId: row.localId, message: "Unknown municipality" } }
    }
    await assertMunicipalityInScope(ctx, me, row.municipalityId)
    if (row.wardNo) assertCanReadWard(me, row.municipalityId, row.wardNo)

    let existing: Doc<"surveys"> | null = null
    const pid = row.propertyId?.trim().toUpperCase()
    if (pid) {
      existing = (await lookupSurveyByPropertyId(ctx, pid)) ?? null
    }
    if (!existing) {
      existing =
        (await ctx.db
          .query("surveys")
          .withIndex("by_surveyor_localId", (q) => q.eq("surveyorId", me._id).eq("localId", row.localId))
          .unique()) ?? null
    }

    if (existing) {
      await assertCanAccessSurvey(ctx, me, existing)
      await assertSurveyWritable(ctx, me, existing)
    }

    const merged = mergeDraftArgs(
      existing,
      {
        localId: row.localId,
        municipalityId: row.municipalityId,
        clientUpdatedAt: Date.now(),
        wardNo: row.wardNo,
        sectorNo: row.sectorNo,
        oldPropertyNo: row.oldPropertyNo,
        propertyId: pid,
        parcelNo: row.parcelNo,
        unitNo: row.unitNo,
        constructedYear: row.constructedYear,
        isSlum: row.isSlum,
        respondentName: row.respondentName,
        relationship: row.relationship,
        owners: row.owners,
        familySize: row.familySize,
        mobileNo: row.mobileNo,
        altMobileNo: row.altMobileNo,
        houseNo: row.houseNo,
        locality: row.locality,
        colonyName: row.colonyName,
        pinCode: row.pinCode,
        city: row.city ?? muni.name,
        assessmentYear: row.assessmentYear,
        ownershipType: row.ownershipType,
        propertyType: row.propertyType,
        propertyUse: row.propertyUse,
        situation: row.situation,
        roadType: row.roadType,
        taxRateZone: row.taxRateZone,
        plotSqft: row.plotSqft,
        plinthSqft: row.plinthSqft,
        municipalWaterConnection: row.municipalWaterConnection,
        waterSource: row.waterSource as Doc<"surveys">["waterSource"],
        sanitationType: row.sanitationType as Doc<"surveys">["sanitationType"],
        municipalWasteCollection: row.municipalWasteCollection,
        electricityNo: row.electricityNo,
      },
      muni,
    )

    const normalized = normalizeAddressFields(
      normalizeOwnerFields(withResolvedPropertyId(normalizePropertyFields(merged), muni.code)),
      muni,
    ) as SurveyUpsertArgs

    const writable = {
      ...stripLocalId(normalized as Parameters<typeof stripLocalId>[0]),
      districtId: muni.districtId,
    }

    return { kind: "ready", localId: row.localId, existing, normalized, writable, pid }
  } catch (e) {
    return {
      kind: "error",
      error: {
        localId: row.localId,
        propertyId: row.propertyId,
        message: e instanceof Error ? e.message : "Import failed",
      },
    }
  }
}

/** Insert or patch a survey and update analytics — must not be wrapped in a catch. */
export async function commitExcelSurveyImport(
  ctx: MutationCtx,
  me: Doc<"users">,
  plan: Extract<ImportSurveyPlan, { kind: "ready" }>,
  propertyIdToSurveyId: Map<string, Id<"surveys">>,
): Promise<{ outcome: "created" | "updated"; surveyId: Id<"surveys"> }> {
  const { localId, existing, normalized, writable, pid } = plan

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...writable,
      serverVersion: existing.serverVersion + 1,
      clientUpdatedAt: Date.now(),
    })
    const updatedSurvey = await ctx.db.get(existing._id)
    if (updatedSurvey) await recordSurveyStatsUpdate(ctx, existing, updatedSurvey)
    registerPropertyIdMapping(propertyIdToSurveyId, existing._id, normalized.propertyId, pid)
    return { outcome: "updated", surveyId: existing._id }
  }

  const newId = await ctx.db.insert("surveys", {
    ...writable,
    surveyorId: me._id,
    localId,
    status: "draft",
    qcStatus: "pending",
    serverVersion: 1,
    clientUpdatedAt: Date.now(),
  } as Doc<"surveys">)
  const createdSurvey = await ctx.db.get(newId)
  if (createdSurvey) await recordSurveyStatsInsert(ctx, createdSurvey)
  registerPropertyIdMapping(propertyIdToSurveyId, newId, normalized.propertyId, pid)
  return { outcome: "created", surveyId: newId }
}

/** Apply floor rows for one property ID; validation failures append to errors. */
export async function importExcelFloorRows(
  ctx: MutationCtx,
  me: Doc<"users">,
  floors: ImportFloorRow[],
  propertyIdToSurveyId: Map<string, Id<"surveys">>,
): Promise<ImportSurveyRowError[]> {
  const errors: ImportSurveyRowError[] = []

  for (const fl of floors) {
    const pid = fl.propertyId.trim().toUpperCase()
    let surveyId = propertyIdToSurveyId.get(pid)
    if (!surveyId) {
      const s = await lookupSurveyByPropertyId(ctx, pid)
      surveyId = s?._id
    }
    if (!surveyId) {
      errors.push({ propertyId: pid, message: "Floor row: survey not found for Property ID" })
      continue
    }
    const survey = await ctx.db.get(surveyId)
    if (!survey) continue
    await assertCanAccessSurvey(ctx, me, survey)
    await assertSurveyWritable(ctx, me, survey)

    const normalized = normalizeFloorFields({ usageFactor: fl.usageFactor, usageType: fl.usageType })
    const floorErrors = validateFloorRow({
      floorName: fl.floorName,
      usageFactor: normalized.usageFactor || undefined,
      usageType: normalized.usageType,
      constructionType: fl.constructionType,
      areaSqft: fl.areaSqft,
    })
    if (Object.keys(floorErrors).length > 0) {
      errors.push({ propertyId: pid, message: "Invalid floor row" })
      continue
    }

    const existing = await ctx.db
      .query("floors")
      .withIndex("by_survey_clientFloorId", (q) => q.eq("surveyId", surveyId!).eq("clientFloorId", fl.clientFloorId))
      .unique()

    const floorDoc = {
      position: fl.position,
      floorName: fl.floorName,
      usageFactor: normalized.usageFactor || undefined,
      usageType: normalized.usageType,
      constructionType: fl.constructionType,
      isOccupied: fl.isOccupied ?? usageTypeToOccupied(normalized.usageType),
      areaSqft: fl.areaSqft,
    }

    if (existing) {
      await ctx.db.patch(existing._id, floorDoc)
    } else {
      await ctx.db.insert("floors", { surveyId: surveyId!, clientFloorId: fl.clientFloorId, ...floorDoc })
    }
  }

  return errors
}

export function importPlanToClientError(error: ImportSurveyRowError): never {
  clientError("VALIDATION", error.message)
}
