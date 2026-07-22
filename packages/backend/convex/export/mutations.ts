import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { mutation } from "../_generated/server"
import { MAX_IMPORT_FLOORS, MAX_IMPORT_SURVEYS } from "../lib/budgetLimits"
import { logSlowPath } from "../lib/observability"
import { requireCapability } from "../shared/capabilities"
import { clientError, requireUser, writeAudit } from "../shared/helpers"
import {
  commitExcelSurveyImport,
  importExcelFloorRows,
  importPlanToClientError,
  planExcelSurveyImport,
} from "./importExcelSurvey"

export { MAX_IMPORT_FLOORS, MAX_IMPORT_SURVEYS }

const importSurveyRow = v.object({
  localId: v.string(),
  municipalityId: v.id("municipalities"),
  wardNo: v.string(),
  propertyId: v.optional(v.string()),
  sectorNo: v.optional(v.string()),
  oldPropertyNo: v.optional(v.string()),
  parcelNo: v.string(),
  unitNo: v.string(),
  constructedYear: v.optional(v.number()),
  isSlum: v.optional(v.boolean()),
  respondentName: v.optional(v.string()),
  relationship: v.optional(v.string()),
  familySize: v.optional(v.number()),
  mobileNo: v.optional(v.string()),
  altMobileNo: v.optional(v.string()),
  houseNo: v.optional(v.string()),
  locality: v.optional(v.string()),
  colonyName: v.optional(v.string()),
  city: v.optional(v.string()),
  pinCode: v.optional(v.string()),
  assessmentYear: v.optional(v.string()),
  ownershipType: v.optional(v.string()),
  propertyType: v.optional(v.string()),
  propertyUse: v.optional(v.string()),
  situation: v.optional(v.string()),
  roadType: v.optional(v.string()),
  taxRateZone: v.optional(v.string()),
  plotSqft: v.optional(v.number()),
  plinthSqft: v.optional(v.number()),
  municipalWaterConnection: v.optional(v.boolean()),
  waterSource: v.optional(v.string()),
  sanitationType: v.optional(v.string()),
  municipalWasteCollection: v.optional(v.boolean()),
  electricityNo: v.optional(v.string()),
  owners: v.optional(
    v.array(
      v.object({
        name: v.optional(v.string()),
        fatherOrHusbandName: v.optional(v.string()),
        mobileNo: v.optional(v.string()),
        altMobileNo: v.optional(v.string()),
      }),
    ),
  ),
})

const importFloorRow = v.object({
  propertyId: v.string(),
  clientFloorId: v.string(),
  position: v.number(),
  floorName: v.string(),
  usageFactor: v.optional(v.string()),
  usageType: v.string(),
  constructionType: v.string(),
  isOccupied: v.optional(v.boolean()),
  areaSqft: v.number(),
})

/** Import one survey row (+ optional floors) atomically with analytics rollups. */
export const importExcelSurveyRow = mutation({
  args: {
    survey: importSurveyRow,
    floors: v.optional(v.array(importFloorRow)),
  },
  returns: v.union(
    v.object({ outcome: v.literal("created"), surveyId: v.id("surveys") }),
    v.object({ outcome: v.literal("updated"), surveyId: v.id("surveys") }),
  ),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "reports.export")

    const propertyIdToSurveyId = new Map<string, Id<"surveys">>()
    const plan = await planExcelSurveyImport(ctx, me, args.survey)
    if (plan.kind === "error") importPlanToClientError(plan.error)

    const result = await commitExcelSurveyImport(ctx, me, plan, propertyIdToSurveyId)
    if (args.floors?.length) {
      const floorErrors = await importExcelFloorRows(ctx, me, args.floors, propertyIdToSurveyId)
      if (floorErrors.length > 0) {
        clientError("VALIDATION", floorErrors[0]!.message)
      }
    }

    return result
  },
})

/** Re-import survey + floor rows from Excel (supervisor/admin). Matches by Property ID or Local ID. */
export const importExcelBundle = mutation({
  args: {
    surveys: v.array(importSurveyRow),
    floors: v.optional(v.array(importFloorRow)),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    errors: v.array(
      v.object({
        propertyId: v.optional(v.string()),
        localId: v.optional(v.string()),
        message: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const startedAt = Date.now()
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "reports.export")

    if (args.surveys.length > MAX_IMPORT_SURVEYS) {
      clientError(
        "VALIDATION",
        `Import is limited to ${MAX_IMPORT_SURVEYS} surveys per request — split the file into smaller batches`,
      )
    }
    if ((args.floors?.length ?? 0) > MAX_IMPORT_FLOORS) {
      clientError(
        "VALIDATION",
        `Import is limited to ${MAX_IMPORT_FLOORS} floor rows per request — split the file into smaller batches`,
      )
    }

    let created = 0
    let updated = 0
    const errors: { propertyId?: string; localId?: string; message: string }[] = []
    const propertyIdToSurveyId = new Map<string, Id<"surveys">>()

    for (const row of args.surveys) {
      const plan = await planExcelSurveyImport(ctx, me, row)
      if (plan.kind === "error") {
        errors.push(plan.error)
        continue
      }

      const result = await commitExcelSurveyImport(ctx, me, plan, propertyIdToSurveyId)
      if (result.outcome === "created") created++
      else updated++
    }

    errors.push(...(await importExcelFloorRows(ctx, me, args.floors ?? [], propertyIdToSurveyId)))

    await writeAudit(ctx, {
      actorId: me._id,
      action: "survey.excel_import",
      entity: "survey",
      entityId: me._id,
      metadata: { created, updated, errorCount: errors.length },
    })

    logSlowPath("export.importExcelBundle", startedAt, {
      surveyCount: args.surveys.length,
      floorCount: args.floors?.length ?? 0,
      created,
      updated,
      errorCount: errors.length,
    })

    return { created, updated, errors }
  },
})
