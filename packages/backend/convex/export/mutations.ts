import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { mutation } from "../_generated/server"
import { normalizeAddressFields } from "../masters/helpers"
import { normalizeFloorFields, usageTypeToOccupied, validateFloorRow } from "../lib/masters/areaMasters"
import { requireCapability } from "../shared/capabilities"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { assertCanReadWard, requireUser, writeAudit } from "../shared/helpers"
import { lookupSurveyByPropertyId } from "../lib/propertyIdLookup"
import { recordSurveyStatsInsert, recordSurveyStatsUpdate } from "../lib/surveyScopeStats"
import {
  assertSurveyWritable,
  mergeDraftArgs,
  normalizeOwnerFields,
  normalizePropertyFields,
  stripLocalId,
  withResolvedPropertyId,
} from "../surveys/helpers"
import { assertMunicipalityInScope } from "../shared/tenancy"
import { registerPropertyIdMapping } from "./helpers"

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
      })
    )
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

/** Re-import survey + floor rows from Excel (supervisor/admin). Matches by Property ID or Local ID. */
export const importExcelBundle = mutation({
  args: {
    surveys: v.array(importSurveyRow),
    floors: v.optional(v.array(importFloorRow)),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "reports.export")

    let created = 0
    let updated = 0
    const errors: { propertyId?: string; localId?: string; message: string }[] = []
    const propertyIdToSurveyId = new Map<string, Id<"surveys">>()

    for (const row of args.surveys) {
      try {
        const muni = await ctx.db.get(row.municipalityId)
        if (!muni) {
          errors.push({ localId: row.localId, message: "Unknown municipality" })
          continue
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
          muni
        )

        const normalized = normalizeAddressFields(
          normalizeOwnerFields(withResolvedPropertyId(normalizePropertyFields(merged), muni.code)),
          muni
        )

        const writable = {
          ...stripLocalId(normalized as Parameters<typeof stripLocalId>[0]),
          districtId: muni.districtId,
        }

        if (existing) {
          await assertCanAccessSurvey(ctx, me, existing)
          await assertSurveyWritable(ctx, me, existing)
          await ctx.db.patch(existing._id, {
            ...writable,
            serverVersion: existing.serverVersion + 1,
            clientUpdatedAt: Date.now(),
          })
          const updatedSurvey = await ctx.db.get(existing._id)
          if (updatedSurvey) await recordSurveyStatsUpdate(ctx, existing, updatedSurvey)
          updated++
          registerPropertyIdMapping(propertyIdToSurveyId, existing._id, normalized.propertyId, pid)
        } else {
          const newId = await ctx.db.insert("surveys", {
            ...writable,
            surveyorId: me._id,
            localId: row.localId,
            status: "draft",
            qcStatus: "pending",
            serverVersion: 1,
            clientUpdatedAt: Date.now(),
          } as Doc<"surveys">)
          const createdSurvey = await ctx.db.get(newId)
          if (createdSurvey) await recordSurveyStatsInsert(ctx, createdSurvey)
          created++
          registerPropertyIdMapping(propertyIdToSurveyId, newId, normalized.propertyId, pid)
        }
      } catch (e) {
        errors.push({
          localId: row.localId,
          propertyId: row.propertyId,
          message: e instanceof Error ? e.message : "Import failed",
        })
      }
    }

    for (const fl of args.floors ?? []) {
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

    await writeAudit(ctx, {
      actorId: me._id,
      action: "survey.excel_import",
      entity: "survey",
      entityId: me._id,
      metadata: { created, updated, errorCount: errors.length },
    })

    return { created, updated, errors }
  },
})
