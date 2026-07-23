import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { mutation, type MutationCtx } from "../_generated/server"
import { validateGps } from "../lib/gpsValidation"
import {
  derivePlotSqftForSubmit,
  normalizeFloorFields,
  plinthSqftFromFloors,
  usageTypeToOccupied,
  validateAreaSection,
  validateFloorRow,
} from "../lib/masters/areaMasters"
import { loadAllowedTaxZoneSet, normalizeTaxationFields } from "../lib/masters/taxationMasters"
import { logSlowPath } from "../lib/observability"
import {
  completionPctForSurvey,
  computeSurveyCompletionPercent,
  refreshSurveyCompletionPct,
} from "../lib/surveyProgress"
import { recordSurveyStatsInsert, recordSurveyStatsRemove, recordSurveyStatsUpdate } from "../lib/surveyScopeStats"
import { assertUniqueSurveySlot, surveyIdentifyingSlotChanged } from "../lib/surveyUniqueness"
import { addressTenantContext, normalizeAddressFields } from "../masters/helpers"
import { gpsCapture } from "../schema"
import { hasCapability, requireCapability } from "../shared/capabilities"
import { canInsertSurveyDraft, isOwnScopeSurveyor } from "../shared/fieldAccess"
import { assertCanReadWard, clientError, requireUser, writeAudit } from "../shared/helpers"
import { assertMunicipalityInScope } from "../shared/tenancy"
import {
  assertSurveyWritable,
  auditActionForSave,
  buildSurveyPartialPatch,
  mergeDraftArgs,
  normalizeOwnerFields,
  normalizePropertyFields,
  requireSurveyDraftEdit,
  resolveExistingSurveyForSave,
  resolvePostSaveStatuses,
  stripLocalId,
  validateBusinessRules,
  withResolvedPropertyId,
  type SurveyUpsertArgs,
} from "./helpers"
import { draftSurveyInput, submitFloorRow, surveyInput } from "./validators"
/**
 * Save in-progress survey data without requiring every step to be complete.
 * Full business rules (PIN vs ULB, owner mobile, taxation, etc.) run on
 * `submit` instead.
 *
 * Production constraints:
 * - Idempotent / retry-safe via localId + existing resolution
 * - Draft completion churn skips shared rollup writes inside recordSurveyAnalyticsUpdate
 * - Cheap completion % (presence-only floor/photo reads)
 * - Partial patch only — no full document replace
 */
export const saveDraft = mutation({
  args: draftSurveyInput,
  returns: v.id("surveys"),
  handler: async (ctx, args) => {
    const startedAt = Date.now()
    const me = await requireUser(ctx)
    // Sequential gates — Promise.all sibling rejections become UnhandledPromiseRejection
    // and restart the isolate when auth/scope checks fail in parallel.
    await requireSurveyDraftEdit(ctx, me)
    const muni = await assertMunicipalityInScope(ctx, me, args.municipalityId)
    const ownScope = await isOwnScopeSurveyor(ctx, me)
    const canInsert = await canInsertSurveyDraft(ctx, me)
    const existing = await resolveExistingSurveyForSave(ctx, me, {
      id: args.id,
      localId: args.localId,
      municipalityId: args.municipalityId,
    })
    if (existing) await assertSurveyWritable(ctx, me, existing)
    if (!existing && !canInsert) {
      clientError("BAD_REQUEST", "No survey found to update — open the record from QC review and try saving again")
    }

    const wardNo = args.wardNo?.trim() ?? existing?.wardNo ?? ""
    if (wardNo) {
      assertCanReadWard(me, args.municipalityId, wardNo)
      // Never .unique() — duplicate ward rows throw → isolate restart.
      const wards = await ctx.db
        .query("wards")
        .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", args.municipalityId).eq("wardNo", wardNo))
        .take(2)
      if (wards.length === 0) clientError("BAD_REQUEST", "Unknown ward", { wardNo: ["unknown ward"] })
    }

    const district = await ctx.db.get(muni.districtId)
    const addressCtx = {
      ...addressTenantContext(muni, district),
      configuredPostalCode: muni.postalCode,
    }

    const merged = mergeDraftArgs(existing, args, muni)
    // Skip tax-zone master collect when draft has no zone set / unchanged.
    const taxZoneEmpty = !(merged.taxRateZone as string | undefined)?.trim() && !(existing?.taxRateZone ?? "").trim()
    const allowedTaxZones = taxZoneEmpty ? new Set<string>() : await loadAllowedTaxZoneSet(ctx)
    const normalized = normalizeAddressFields(
      normalizeOwnerFields(normalizeTaxationFields(withResolvedPropertyId(normalizePropertyFields(merged), muni.code))),
      muni
    )
    validateBusinessRules(normalized, addressCtx, "draft", { allowedTaxZones })

    if (existing && existing.status === "submitted") {
      const isQcEditor = await hasCapability(ctx, me, "qc.review")
      if (isQcEditor && surveyIdentifyingSlotChanged(existing, normalized, muni.code)) {
        await assertUniqueSurveySlot(ctx, {
          municipalityId: args.municipalityId,
          wardNo: (normalized.wardNo as string) ?? existing.wardNo,
          parcelNo: normalized.parcelNo as string,
          propertyUse: normalized.propertyUse as string | undefined,
          unitNo: normalized.unitNo as string | undefined,
          propertyId: normalized.propertyId as string | undefined,
          excludeId: existing._id,
        })
      }
    }

    const writable = { ...stripLocalId(normalized as SurveyUpsertArgs), districtId: muni.districtId }

    if (existing) {
      const { status, qcStatus } = resolvePostSaveStatuses(existing)
      const completionPct = await completionPctForSurvey(ctx, { ...existing, ...writable } as Doc<"surveys">)

      const patch = buildSurveyPartialPatch(existing, writable as Record<string, unknown>, {
        status,
        qcStatus,
        clientUpdatedAt: args.clientUpdatedAt,
        completionPct,
      })

      if (Object.keys(patch).length === 0) {
        logSlowPath("surveys.saveDraft", startedAt, {
          mode: "update_noop",
          surveyId: existing._id,
        })
        return existing._id
      }

      await ctx.db.patch(existing._id, patch)

      const updated: Doc<"surveys"> = {
        ...existing,
        ...patch,
      } as Doc<"surveys">

      await recordSurveyStatsUpdate(ctx, existing, updated)

      const staysDraft = existing.status === "draft" && updated.status === "draft"
      if (!staysDraft) {
        await writeAudit(ctx, {
          actorId: me._id,
          action: auditActionForSave(existing, ownScope, false),
          entity: "survey",
          entityId: existing._id,
        })
      }

      logSlowPath("surveys.saveDraft", startedAt, {
        mode: "update",
        surveyId: existing._id,
        staysDraft,
      })
      return existing._id
    }

    // Insert once — re-check for concurrent first-insert race on localId.
    const raced = await resolveExistingSurveyForSave(ctx, me, {
      id: args.id,
      localId: args.localId,
      municipalityId: args.municipalityId,
    })
    if (raced) {
      const { status, qcStatus } = resolvePostSaveStatuses(raced)
      const completionPct = await completionPctForSurvey(ctx, { ...raced, ...writable } as Doc<"surveys">)
      const patch = buildSurveyPartialPatch(raced, writable as Record<string, unknown>, {
        status,
        qcStatus,
        clientUpdatedAt: args.clientUpdatedAt,
        completionPct,
      })
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(raced._id, patch)
        const updated: Doc<"surveys"> = { ...raced, ...patch } as Doc<"surveys">
        await recordSurveyStatsUpdate(ctx, raced, updated)
      }
      logSlowPath("surveys.saveDraft", startedAt, { mode: "insert_race_update", surveyId: raced._id })
      return raced._id
    }

    const completionPct = computeSurveyCompletionPercent({ ...writable, floors: [], photos: [] })
    const newId = await ctx.db.insert("surveys", {
      ...writable,
      surveyorId: me._id,
      localId: args.localId,
      status: "draft",
      qcStatus: "pending",
      serverVersion: 1,
      clientUpdatedAt: args.clientUpdatedAt,
      completionPct,
    })

    // Post-insert dedupe: if another row won the race, delete ours and update the keeper.
    if (ownScope) {
      const siblings = await ctx.db
        .query("surveys")
        .withIndex("by_surveyor_localId", (q) => q.eq("surveyorId", me._id).eq("localId", args.localId))
        .take(3)
      if (siblings.length > 1) {
        const keeper = siblings.reduce((a, b) => (a._creationTime <= b._creationTime ? a : b))
        if (keeper._id !== newId) {
          await ctx.db.delete(newId)
          const { status, qcStatus } = resolvePostSaveStatuses(keeper)
          const pct = await completionPctForSurvey(ctx, { ...keeper, ...writable } as Doc<"surveys">)
          const patch = buildSurveyPartialPatch(keeper, writable as Record<string, unknown>, {
            status,
            qcStatus,
            clientUpdatedAt: args.clientUpdatedAt,
            completionPct: pct,
          })
          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(keeper._id, patch)
            const updated: Doc<"surveys"> = { ...keeper, ...patch } as Doc<"surveys">
            await recordSurveyStatsUpdate(ctx, keeper, updated)
          }
          logSlowPath("surveys.saveDraft", startedAt, { mode: "insert_dedupe", surveyId: keeper._id })
          return keeper._id
        }
      }
    }

    const created = await ctx.db.get(newId)
    if (created) await recordSurveyStatsInsert(ctx, created)
    await writeAudit(ctx, {
      actorId: me._id,
      action: auditActionForSave(null, ownScope, true),
      entity: "survey",
      entityId: newId,
      metadata: { localId: args.localId, draft: true },
    })
    logSlowPath("surveys.saveDraft", startedAt, { mode: "insert", surveyId: newId })
    return newId
  },
})

/**
 * Idempotent upsert with full validation. Prefer `saveDraft` while filling
 * the wizard; use this path only when every required field is present.
 *
 * On every write `serverVersion` increments so the client can detect
 * stale-cache conditions.
 */
export const upsert = mutation({
  args: surveyInput,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    // Sequential gates — same isolate-restart risk as saveDraft under parallel rejection.
    await requireSurveyDraftEdit(ctx, me)
    const muni = await assertMunicipalityInScope(ctx, me, args.municipalityId)
    const ownScope = await isOwnScopeSurveyor(ctx, me)
    const canInsert = await canInsertSurveyDraft(ctx, me)
    assertCanReadWard(me, args.municipalityId, args.wardNo)

    const district = await ctx.db.get(muni.districtId)
    const addressCtx = {
      ...addressTenantContext(muni, district),
      configuredPostalCode: muni.postalCode,
    }
    const allowedTaxZones = await loadAllowedTaxZoneSet(ctx)
    const normalized = normalizeAddressFields(
      normalizeOwnerFields(normalizeTaxationFields(withResolvedPropertyId(normalizePropertyFields(args), muni.code))),
      muni
    )
    validateBusinessRules(normalized, addressCtx, "submit", { allowedTaxZones })

    // Confirm ward exists within the municipality
    const ward = await ctx.db
      .query("wards")
      .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", args.municipalityId).eq("wardNo", args.wardNo))
      .unique()
    if (!ward) clientError("BAD_REQUEST", "Unknown ward", { wardNo: ["unknown ward"] })

    const existing = await resolveExistingSurveyForSave(ctx, me, {
      id: args.id,
      localId: args.localId,
      municipalityId: args.municipalityId,
    })
    if (existing) await assertSurveyWritable(ctx, me, existing)
    if (!existing && !canInsert) {
      clientError("BAD_REQUEST", "No survey found to update — open the record from QC review and try saving again")
    }

    await assertUniqueSurveySlot(ctx, {
      municipalityId: args.municipalityId,
      wardNo: normalized.wardNo as string,
      parcelNo: normalized.parcelNo as string,
      propertyUse: normalized.propertyUse as string | undefined,
      unitNo: normalized.unitNo as string,
      propertyId: normalized.propertyId as string | undefined,
      excludeId: existing?._id,
    })

    const writable = { ...stripLocalId(normalized), districtId: muni.districtId }

    if (existing) {
      const { status, qcStatus } = resolvePostSaveStatuses(existing)
      const completionPct = await completionPctForSurvey(ctx, { ...existing, ...writable } as Doc<"surveys">)

      await ctx.db.patch(existing._id, {
        ...writable,
        status,
        qcStatus,
        serverVersion: existing.serverVersion + 1,
        clientUpdatedAt: args.clientUpdatedAt,
        completionPct,
      })
      const updated: Doc<"surveys"> = {
        ...existing,
        ...writable,
        status,
        qcStatus,
        serverVersion: existing.serverVersion + 1,
        clientUpdatedAt: args.clientUpdatedAt,
        completionPct,
      }
      await recordSurveyStatsUpdate(ctx, existing, updated)
      await writeAudit(ctx, {
        actorId: me._id,
        action: auditActionForSave(existing, ownScope, false),
        entity: "survey",
        entityId: existing._id,
      })
      return existing._id
    }

    const completionPct = computeSurveyCompletionPercent({ ...writable, floors: [], photos: [] })
    const newId = await ctx.db.insert("surveys", {
      ...writable,
      surveyorId: me._id,
      localId: args.localId,
      status: "draft",
      qcStatus: "pending",
      serverVersion: 1,
      clientUpdatedAt: args.clientUpdatedAt,
      completionPct,
    })
    const created = await ctx.db.get(newId)
    if (created) await recordSurveyStatsInsert(ctx, created)
    await writeAudit(ctx, {
      actorId: me._id,
      action: "survey.created",
      entity: "survey",
      entityId: newId,
      metadata: { localId: args.localId },
    })
    return newId
  },
})

/** Attach or refresh GPS on a draft survey before submit. */
export const setGps = mutation({
  args: { id: v.id("surveys"), gps: gpsCapture },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const [survey, ownScope] = await Promise.all([ctx.db.get(args.id), isOwnScopeSurveyor(ctx, me)])
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    if (ownScope && survey.surveyorId !== me._id) {
      clientError("FORBIDDEN", "Not your survey")
    }
    await assertMunicipalityInScope(ctx, me, survey.municipalityId)
    assertCanReadWard(me, survey.municipalityId, survey.wardNo)
    await assertSurveyWritable(ctx, me, survey)
    const gpsMessage = validateGps(args.gps, { strict: false })
    if (gpsMessage) {
      clientError("VALIDATION", gpsMessage, { gps: [gpsMessage] })
    }
    await ctx.db.patch(args.id, {
      gps: args.gps,
      serverVersion: survey.serverVersion + 1,
    })
    await refreshSurveyCompletionPct(ctx, survey)
  },
})

type SubmitFloorRow = {
  clientFloorId: string
  position: number
  floorName: string
  usageFactor?: string
  usageType: string
  constructionType: string
  isOccupied: boolean
  areaSqft: number
}

async function syncSubmitArea(
  ctx: MutationCtx,
  survey: Doc<"surveys">,
  input: {
    plotSqft?: number
    plinthSqft?: number
    floors?: SubmitFloorRow[]
    keepClientFloorIds?: string[]
  }
): Promise<Doc<"surveys">> {
  let serverVersion = survey.serverVersion

  if (input.floors) {
    await Promise.all(
      input.floors.map(async (fl) => {
        const normalized = normalizeFloorFields({
          usageFactor: fl.usageFactor,
          usageType: fl.usageType,
        })
        const floorErrors = validateFloorRow({
          floorName: fl.floorName,
          usageFactor: normalized.usageFactor || undefined,
          usageType: normalized.usageType,
          constructionType: fl.constructionType,
          areaSqft: fl.areaSqft,
        })
        if (Object.keys(floorErrors).length > 0) {
          clientError("VALIDATION", "Invalid floor row", floorErrors)
        }

        const row = {
          position: fl.position,
          floorName: fl.floorName,
          usageFactor: normalized.usageFactor || undefined,
          usageType: normalized.usageType,
          constructionType: fl.constructionType,
          isOccupied: usageTypeToOccupied(normalized.usageType),
          areaSqft: fl.areaSqft,
        }

        const existing = await ctx.db
          .query("floors")
          .withIndex("by_survey_clientFloorId", (q) =>
            q.eq("surveyId", survey._id).eq("clientFloorId", fl.clientFloorId)
          )
          .unique()

        if (existing) {
          await ctx.db.patch(existing._id, row)
        } else {
          await ctx.db.insert("floors", {
            surveyId: survey._id,
            clientFloorId: fl.clientFloorId,
            ...row,
          })
        }
      })
    )

    if (input.keepClientFloorIds) {
      const keep = new Set(input.keepClientFloorIds)
      const rows = await ctx.db
        .query("floors")
        .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
        .collect()
      const deleteOps = []
      for (const row of rows) {
        if (!keep.has(row.clientFloorId)) deleteOps.push(ctx.db.delete(row._id))
      }
      await Promise.all(deleteOps)
    }

    serverVersion += 1
  }

  const floorRows = await ctx.db
    .query("floors")
    .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
    .collect()

  const resolvedPlot =
    input.plotSqft !== undefined && input.plotSqft > 0
      ? input.plotSqft
      : derivePlotSqftForSubmit(survey.plotSqft, floorRows)
  const resolvedPlinth = input.plinthSqft ?? plinthSqftFromFloors(floorRows)

  const areaPatch: Partial<Pick<Doc<"surveys">, "plotSqft" | "plinthSqft">> = {}
  if (resolvedPlot > 0 && resolvedPlot !== survey.plotSqft) areaPatch.plotSqft = resolvedPlot
  if (resolvedPlinth !== survey.plinthSqft) areaPatch.plinthSqft = resolvedPlinth

  if (Object.keys(areaPatch).length > 0 || input.floors) {
    await ctx.db.patch(survey._id, {
      ...areaPatch,
      serverVersion: serverVersion + 1,
    })
    const updated = await ctx.db.get(survey._id)
    if (!updated) clientError("NOT_FOUND", "Survey not found")
    return updated
  }

  return survey
}

async function ensureSurveyAreaReady(ctx: MutationCtx, survey: Doc<"surveys">): Promise<Doc<"surveys">> {
  const floors = await ctx.db
    .query("floors")
    .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
    .collect()
  const derivedPlot = derivePlotSqftForSubmit(survey.plotSqft, floors)
  if (!(derivedPlot > 0) || derivedPlot === survey.plotSqft) {
    return survey
  }
  const plinthSqft = plinthSqftFromFloors(floors)
  await ctx.db.patch(survey._id, {
    plotSqft: derivedPlot,
    plinthSqft,
    serverVersion: survey.serverVersion + 1,
  })
  const updated = await ctx.db.get(survey._id)
  if (!updated) clientError("NOT_FOUND", "Survey not found")
  return updated
}

/**
 * Transitions a draft to `submitted`. Requires at least one floor row
 * (built-up or open land) with area > 0, plus required photos (front + side).
 * Optional `floors` / `plotSqft` sync area rows before validation (mobile submit).
 */
export const submit = mutation({
  args: {
    id: v.id("surveys"),
    plotSqft: v.optional(v.number()),
    plinthSqft: v.optional(v.number()),
    floors: v.optional(v.array(submitFloorRow)),
    keepClientFloorIds: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [me, surveyOrNull] = await Promise.all([requireUser(ctx), ctx.db.get(args.id)])
    let survey = surveyOrNull
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    const [, ownScope] = await Promise.all([requireCapability(ctx, me, "surveys.submit"), isOwnScopeSurveyor(ctx, me)])
    if (survey.surveyorId !== me._id && ownScope) {
      clientError("FORBIDDEN", "Not your survey")
    }
    if (survey.status !== "draft" && survey.status !== "rejected") {
      const message =
        survey.status === "submitted"
          ? "This survey is already submitted and awaiting QC review"
          : survey.status === "approved"
            ? "Approved surveys cannot be submitted again"
            : "Only draft surveys can be submitted"
      clientError("BAD_STATE", message)
    }
    await assertMunicipalityInScope(ctx, me, survey.municipalityId)
    assertCanReadWard(me, survey.municipalityId, survey.wardNo)

    const hasAreaSync = args.plotSqft !== undefined || args.plinthSqft !== undefined || args.floors !== undefined
    if (hasAreaSync) {
      survey = await syncSubmitArea(ctx, survey, {
        plotSqft: args.plotSqft,
        plinthSqft: args.plinthSqft,
        floors: args.floors,
        keepClientFloorIds: args.keepClientFloorIds,
      })
    } else {
      survey = await ensureSurveyAreaReady(ctx, survey)
    }

    const floors = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
      .collect()
    const areaErrors = validateAreaSection({
      plotSqft: survey.plotSqft,
      plinthSqft: survey.plinthSqft,
      floors: floors.map((f) => ({ floorName: f.floorName, areaSqft: f.areaSqft })),
    })
    if (Object.keys(areaErrors).length > 0) {
      clientError("VALIDATION", "Area details incomplete", areaErrors)
    }

    const photos = await ctx.db
      .query("photos")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
      .collect()
    const slots = new Set(photos.map((p) => p.slot))
    const missing: string[] = []
    if (!slots.has("front")) missing.push("front photo required")
    if (!slots.has("side")) missing.push("side photo required")
    if (missing.length > 0) {
      clientError("VALIDATION", "Required photos missing", { photos: missing })
    }
    if (!survey.gps) {
      clientError("VALIDATION", "GPS capture required", { gps: ["capture GPS first"] })
    }

    const muni = await ctx.db.get(survey.municipalityId)
    if (!muni) clientError("NOT_FOUND", "Municipality not found")
    const district = await ctx.db.get(muni.districtId)
    const addressCtx = {
      ...addressTenantContext(muni, district),
      configuredPostalCode: muni.postalCode,
    }
    const allowedTaxZones = await loadAllowedTaxZoneSet(ctx)
    validateBusinessRules(survey as unknown as Record<string, unknown>, addressCtx, "submit", {
      allowedTaxZones,
    })

    await ctx.db.patch(args.id, {
      status: "submitted",
      qcStatus: survey.qcStatus === "rejected" ? "pending" : survey.qcStatus,
      submittedAt: Date.now(),
      serverVersion: survey.serverVersion + 1,
    })
    const submitted = await ctx.db.get(args.id)
    if (submitted) await recordSurveyStatsUpdate(ctx, survey, submitted)
    await writeAudit(ctx, {
      actorId: me._id,
      action: "survey.submitted",
      entity: "survey",
      entityId: args.id,
    })

    return null
  },
})

export const remove = mutation({
  args: { id: v.id("surveys") },
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.id)])
    if (!survey) return
    if (survey.surveyorId !== me._id && me.role !== "admin") {
      clientError("FORBIDDEN", "Not your survey")
    }
    await assertMunicipalityInScope(ctx, me, survey.municipalityId)
    if (survey.qcStatus === "approved") {
      clientError("LOCKED", "Cannot delete an approved survey")
    }

    // Cascade delete child rows.
    for await (const f of ctx.db.query("floors").withIndex("by_survey", (q) => q.eq("surveyId", args.id))) {
      await ctx.db.delete(f._id)
    }
    for await (const p of ctx.db.query("photos").withIndex("by_survey", (q) => q.eq("surveyId", args.id))) {
      await ctx.storage.delete(p.storageId)
      await ctx.db.delete(p._id)
    }
    for await (const r of ctx.db.query("qcRemarks").withIndex("by_survey", (q) => q.eq("surveyId", args.id))) {
      await ctx.db.delete(r._id)
    }
    await recordSurveyStatsRemove(ctx, survey)
    await ctx.db.delete(args.id)

    await writeAudit(ctx, {
      actorId: me._id,
      action: "survey.deleted",
      entity: "survey",
      entityId: args.id,
    })
  },
})
