/**
 * Self-hosted ops: audit Etah/Baghpat (or any district codes) ward masters
 * vs live survey wardNos, and upsert missing wards from field data.
 *
 * Ops notes (isolate safety):
 * - Do NOT recreate a scratch UDF named `testQuery` — dashboard/CLI logs like
 *   `UDF: testQuery.js:default` are one-off `--inline-query` runs, not app code.
 * - Never chain multiple `.paginate()` calls in one UDF (Convex allows only one
 *   paginated query per function). This module uses `.collect()` per status instead.
 */
import { v } from "convex/values"
import { internal } from "../_generated/api"
import type { Doc, Id } from "../_generated/dataModel"
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server"
import { normalizeWardNo } from "../lib/qcWardStats"
import { wardNoSpellingVariants } from "../surveys/helpers"

const DEFAULT_DISTRICT_CODES = ["ETA", "BAG"] as const

const SURVEY_STATUSES = ["draft", "submitted", "approved", "rejected"] as const

const wardGapValidator = v.object({
  municipalityId: v.id("municipalities"),
  municipalityCode: v.string(),
  municipalityName: v.string(),
  districtCode: v.string(),
  surveyWardNo: v.string(),
  surveyCount: v.number(),
  masterWardNos: v.array(v.string()),
})

const muniAuditValidator = v.object({
  municipalityId: v.id("municipalities"),
  municipalityCode: v.string(),
  municipalityName: v.string(),
  districtCode: v.string(),
  masterWardNos: v.array(v.string()),
  surveyWardSpellings: v.array(v.string()),
  surveyTotal: v.number(),
  rollupTotal: v.union(v.number(), v.null()),
  rollupMatchesSurvey: v.boolean(),
  missingFromMasters: v.array(v.string()),
})

async function loadDistrictsByCodes(ctx: QueryCtx, codes: string[]): Promise<Doc<"districts">[]> {
  const codeSet = new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))
  const districts = await ctx.db.query("districts").collect()
  return districts.filter((d) => codeSet.has(d.code.toUpperCase()))
}

async function loadSurveysForMunicipality(
  ctx: QueryCtx,
  municipalityId: Id<"municipalities">
): Promise<Doc<"surveys">[]> {
  const pages = await Promise.all(
    SURVEY_STATUSES.map((status) =>
      ctx.db
        .query("surveys")
        .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId).eq("status", status))
        .collect()
    )
  )
  return pages.flat()
}

function masterCoversSpelling(masterWardNos: string[], spelling: string): boolean {
  const masterNormalized = new Set(masterWardNos.map((w) => normalizeWardNo(w)))
  const variants = wardNoSpellingVariants(spelling)
  return variants.some((v) => masterWardNos.includes(v) || masterNormalized.has(normalizeWardNo(v)))
}

/** Compare master wards to distinct survey wardNos for ETA/BAG (default) districts. */
export const auditDistrictWards = internalQuery({
  args: {
    districtCodes: v.optional(v.array(v.string())),
  },
  returns: v.object({
    districts: v.array(
      v.object({
        districtId: v.id("districts"),
        code: v.string(),
        name: v.string(),
      })
    ),
    municipalities: v.array(muniAuditValidator),
    gaps: v.array(wardGapValidator),
  }),
  handler: async (ctx, args) => {
    const codes = (args.districtCodes?.length ? args.districtCodes : [...DEFAULT_DISTRICT_CODES]).map((c) =>
      c.trim().toUpperCase()
    )
    const districts = await loadDistrictsByCodes(ctx, codes)

    const municipalities: Array<{
      municipalityId: Id<"municipalities">
      municipalityCode: string
      municipalityName: string
      districtCode: string
      masterWardNos: string[]
      surveyWardSpellings: string[]
      surveyTotal: number
      rollupTotal: number | null
      rollupMatchesSurvey: boolean
      missingFromMasters: string[]
    }> = []
    const gaps: Array<{
      municipalityId: Id<"municipalities">
      municipalityCode: string
      municipalityName: string
      districtCode: string
      surveyWardNo: string
      surveyCount: number
      masterWardNos: string[]
    }> = []

    for (const district of districts) {
      const munis = await ctx.db
        .query("municipalities")
        .withIndex("by_district", (q) => q.eq("districtId", district._id))
        .collect()

      for (const muni of munis) {
        const [wardRows, surveys, rollupRows] = await Promise.all([
          ctx.db
            .query("wards")
            .withIndex("by_municipality", (q) => q.eq("municipalityId", muni._id))
            .collect(),
          loadSurveysForMunicipality(ctx, muni._id),
          ctx.db
            .query("surveyMunicipalityStats")
            .withIndex("by_municipality", (q) => q.eq("municipalityId", muni._id))
            .collect(),
        ])

        const rollup =
          rollupRows.length === 0
            ? null
            : rollupRows.reduce((best, row) => (row._creationTime > best._creationTime ? row : best))

        const masterWardNos = [...new Set(wardRows.map((w) => w.wardNo.trim()).filter(Boolean))].sort()

        const spellingCounts = new Map<string, number>()
        for (const s of surveys) {
          const w = s.wardNo?.trim()
          if (!w) continue
          spellingCounts.set(w, (spellingCounts.get(w) ?? 0) + 1)
        }
        const surveyWardSpellings = [...spellingCounts.keys()].sort()

        const missingFromMasters: string[] = []
        for (const [spelling, count] of spellingCounts) {
          if (!masterCoversSpelling(masterWardNos, spelling)) {
            missingFromMasters.push(spelling)
            gaps.push({
              municipalityId: muni._id,
              municipalityCode: muni.code,
              municipalityName: muni.name,
              districtCode: district.code,
              surveyWardNo: spelling,
              surveyCount: count,
              masterWardNos,
            })
          }
        }

        const surveyTotal = surveys.length
        const rollupTotal = rollup?.total ?? null
        municipalities.push({
          municipalityId: muni._id,
          municipalityCode: muni.code,
          municipalityName: muni.name,
          districtCode: district.code,
          masterWardNos,
          surveyWardSpellings,
          surveyTotal,
          rollupTotal,
          rollupMatchesSurvey: rollupTotal === null ? false : rollupTotal === surveyTotal,
          missingFromMasters: [...new Set(missingFromMasters)].sort(),
        })
      }
    }

    return {
      districts: districts.map((d) => ({
        districtId: d._id,
        code: d.code,
        name: d.name,
      })),
      municipalities,
      gaps,
    }
  },
})

/**
 * Upsert ward master rows for survey wardNos that have no matching master
 * (including numeric spelling variants). Safe to re-run.
 */
export const syncMissingWardsFromSurveys = internalMutation({
  args: {
    districtCodes: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    created: v.array(
      v.object({
        municipalityId: v.id("municipalities"),
        municipalityCode: v.string(),
        wardNo: v.string(),
        wardCode: v.string(),
        name: v.string(),
      })
    ),
    skippedExisting: v.number(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true
    const audit = await ctx.runQuery(internal.tenants.wardAudit.auditDistrictWards, {
      districtCodes: args.districtCodes,
    })

    const created: Array<{
      municipalityId: Id<"municipalities">
      municipalityCode: string
      wardNo: string
      wardCode: string
      name: string
    }> = []
    let skippedExisting = 0

    const seen = new Set<string>()
    for (const gap of audit.gaps) {
      const canonical = normalizeWardNo(gap.surveyWardNo)
      const key = `${gap.municipalityId}:${canonical}`
      if (seen.has(key)) {
        skippedExisting += 1
        continue
      }
      seen.add(key)

      let foundVariant = false
      for (const variant of wardNoSpellingVariants(gap.surveyWardNo)) {
        const rows = await ctx.db
          .query("wards")
          .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", gap.municipalityId).eq("wardNo", variant))
          .take(1)
        if (rows.length > 0) {
          foundVariant = true
          break
        }
      }
      if (foundVariant) {
        skippedExisting += 1
        continue
      }

      const wardCode = `${gap.municipalityCode}-W${canonical}`.toUpperCase()
      const name = `Ward ${canonical}`
      const row = {
        municipalityId: gap.municipalityId,
        municipalityCode: gap.municipalityCode,
        wardNo: canonical,
        wardCode,
        name,
      }
      if (!dryRun) {
        await ctx.db.insert("wards", {
          municipalityId: gap.municipalityId,
          wardNo: canonical,
          wardCode,
          name,
        })
      }
      created.push(row)
    }

    return { dryRun, created, skippedExisting }
  },
})
