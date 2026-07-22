import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { normalizeWardNo } from "./qcWardStats"
import {
  analyticsDimensionsEqual,
  applyCounterDelta,
  countersForSnapshot,
  dailyEventsForTransition,
  diffSurveyCounters,
  qcDecisionDailyEvent,
  shouldSkipCompletionPctRollup,
  snapshotFromSurvey,
  type DailyEventCounters,
  type QcDecisionKind,
  type SurveyAnalyticsSnapshot,
  type SurveyStateCounters,
} from "./surveyAnalyticsModel"
import {
  getDailyStatsRowForGeneration,
  getMunicipalityStatsRowForGeneration,
  getSurveyorStatsRowForGeneration,
  getWardStatsRowForGeneration,
  isLegacyGeneration,
  LEGACY_GENERATION,
  type AnalyticsGeneration,
} from "./surveyAnalyticsLookups"

export { LEGACY_GENERATION, type AnalyticsGeneration }
export const ANALYTICS_META_KEY = "survey-analytics" as const

type WritableGenerations = AnalyticsGeneration[]

function generationIndexValue(generation: AnalyticsGeneration): string | undefined {
  return isLegacyGeneration(generation) ? undefined : generation
}

function snapshotsEqual(a: SurveyAnalyticsSnapshot, b: SurveyAnalyticsSnapshot): boolean {
  return analyticsDimensionsEqual(a, b) && a.completionPct === b.completionPct
}

/** Load singleton analytics metadata, defaulting to legacy generation. */
export async function getAnalyticsMeta(ctx: MutationCtx) {
  const row = await ctx.db
    .query("surveyAnalyticsMeta")
    .withIndex("by_key", (q) => q.eq("key", ANALYTICS_META_KEY))
    .unique()
  if (row) return row
  return {
    _id: undefined,
    activeGeneration: LEGACY_GENERATION,
    buildingGeneration: undefined,
    surveyBackfillCursor: undefined,
    qcBackfillCursor: undefined,
    readyAt: undefined,
  }
}

/** Generations that live writes must maintain (active + optional building). */
export async function writableAnalyticsGenerations(ctx: MutationCtx): Promise<WritableGenerations> {
  const meta = await getAnalyticsMeta(ctx)
  const generations = [meta.activeGeneration]
  if (meta.buildingGeneration && meta.buildingGeneration !== meta.activeGeneration) {
    generations.push(meta.buildingGeneration)
  }
  return generations
}

/** Generation readers should select (only ready generations are activated). */
export async function readableAnalyticsGeneration(ctx: MutationCtx): Promise<AnalyticsGeneration> {
  const meta = await getAnalyticsMeta(ctx)
  return meta.activeGeneration
}

async function getMunicipalityStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">
) {
  return getMunicipalityStatsRowForGeneration(ctx, generation, municipalityId)
}

async function ensureMunicipalityStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">
) {
  const existing = await getMunicipalityStatsRow(ctx, generation, municipalityId)
  if (existing) return existing

  const generationValue = generationIndexValue(generation)
  const id = await ctx.db.insert("surveyMunicipalityStats", {
    ...(generationValue === undefined ? {} : { generation: generationValue }),
    municipalityId,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
    completionPctSum: 0,
    completionPctCount: 0,
  })
  const row = await ctx.db.get(id)
  if (!row) throw new Error("Failed to create municipality stats row")
  return row
}

async function getDistrictStatsRow(ctx: MutationCtx, generation: AnalyticsGeneration, districtId: Id<"districts">) {
  if (isLegacyGeneration(generation)) return null
  return await ctx.db
    .query("surveyDistrictStats")
    .withIndex("by_generation_and_districtId", (q) => q.eq("generation", generation).eq("districtId", districtId))
    .unique()
}

async function ensureDistrictStatsRow(ctx: MutationCtx, generation: AnalyticsGeneration, districtId: Id<"districts">) {
  if (isLegacyGeneration(generation)) return null
  const existing = await getDistrictStatsRow(ctx, generation, districtId)
  if (existing) return existing
  const id = await ctx.db.insert("surveyDistrictStats", {
    generation,
    districtId,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
  })
  return (await ctx.db.get(id))!
}

async function getDailyStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  dateKey: string
) {
  return getDailyStatsRowForGeneration(ctx, generation, municipalityId, dateKey)
}

async function ensureDailyStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  dateKey: string
) {
  const existing = await getDailyStatsRow(ctx, generation, municipalityId, dateKey)
  if (existing) return existing
  const generationValue = generationIndexValue(generation)
  const id = await ctx.db.insert("surveyDailyStats", {
    ...(generationValue === undefined ? {} : { generation: generationValue }),
    municipalityId,
    dateKey,
    created: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  })
  return (await ctx.db.get(id))!
}

async function getWardStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  wardNo: string
) {
  return getWardStatsRowForGeneration(ctx, generation, municipalityId, wardNo)
}

async function ensureWardStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  snapshot: SurveyAnalyticsSnapshot
) {
  if (!snapshot.wardNo?.trim()) return null
  const normalized = normalizeWardNo(snapshot.wardNo)
  const existing = await getWardStatsRow(ctx, generation, snapshot.municipalityId, normalized)
  if (existing) return existing
  const generationValue = generationIndexValue(generation)
  const id = await ctx.db.insert("surveyWardStats", {
    ...(generationValue === undefined ? {} : { generation: generationValue }),
    municipalityId: snapshot.municipalityId,
    wardNo: normalized,
    city: snapshot.city,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
    activeSurveyorIds: [],
  })
  return (await ctx.db.get(id))!
}

async function getSurveyorStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  surveyorId: Id<"users">,
  municipalityId: Id<"municipalities">
) {
  return getSurveyorStatsRowForGeneration(ctx, generation, surveyorId, municipalityId)
}

async function ensureSurveyorStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  snapshot: SurveyAnalyticsSnapshot
) {
  const existing = await getSurveyorStatsRow(ctx, generation, snapshot.surveyorId, snapshot.municipalityId)
  if (existing) return existing
  const generationValue = generationIndexValue(generation)
  const id = await ctx.db.insert("surveySurveyorStats", {
    ...(generationValue === undefined ? {} : { generation: generationValue }),
    surveyorId: snapshot.surveyorId,
    municipalityId: snapshot.municipalityId,
    districtId: snapshot.districtId,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
  })
  return (await ctx.db.get(id))!
}

async function applyCompletionDelta(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  deltaPct: number,
  deltaCount: number
) {
  const row = await ensureMunicipalityStatsRow(ctx, generation, municipalityId)
  await ctx.db.patch(row._id, {
    completionPctSum: Math.max(0, (row.completionPctSum ?? 0) + deltaPct),
    completionPctCount: Math.max(0, (row.completionPctCount ?? 0) + deltaCount),
  })
}

async function applyStateCounterDelta(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  districtId: Id<"districts">,
  delta: SurveyStateCounters
) {
  const muniRow = await ensureMunicipalityStatsRow(ctx, generation, municipalityId)
  await ctx.db.patch(
    muniRow._id,
    applyCounterDelta(
      {
        total: muniRow.total,
        drafts: muniRow.drafts,
        submitted: muniRow.submitted,
        qcApproved: muniRow.qcApproved,
        qcRejected: muniRow.qcRejected,
        qcPending: muniRow.qcPending,
      },
      delta
    )
  )

  const districtRow = await ensureDistrictStatsRow(ctx, generation, districtId)
  if (districtRow) {
    await ctx.db.patch(
      districtRow._id,
      applyCounterDelta(
        {
          total: districtRow.total,
          drafts: districtRow.drafts,
          submitted: districtRow.submitted,
          qcApproved: districtRow.qcApproved,
          qcRejected: districtRow.qcRejected,
          qcPending: districtRow.qcPending,
        },
        delta
      )
    )
  }
}

async function applyDailyEventDeltas(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  deltas: DailyEventCounters[]
) {
  for (const delta of deltas) {
    const row = await ensureDailyStatsRow(ctx, generation, municipalityId, delta.dateKey)
    await ctx.db.patch(row._id, {
      created: Math.max(0, row.created + delta.created),
      submitted: Math.max(0, row.submitted + delta.submitted),
      approved: Math.max(0, (row.approved ?? 0) + delta.approved),
      rejected: Math.max(0, (row.rejected ?? 0) + delta.rejected),
    })
  }
}

async function applyWardCounterDelta(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  snapshot: SurveyAnalyticsSnapshot,
  delta: SurveyStateCounters
) {
  if (!snapshot.wardNo?.trim()) return
  const row = await ensureWardStatsRow(ctx, generation, snapshot)
  if (!row) return
  const next = applyCounterDelta(
    {
      total: row.total,
      drafts: row.drafts,
      submitted: row.submitted,
      qcApproved: row.qcApproved,
      qcRejected: row.qcRejected,
      qcPending: row.qcPending,
    },
    delta
  )

  // Keep activeSurveyorIds roughly correct for command-center ward chips.
  const activeIds = new Set(row.activeSurveyorIds ?? [])
  const surveyorIsActive = snapshot.status === "draft" || snapshot.status === "submitted"
  if (delta.total > 0 && surveyorIsActive) {
    activeIds.add(snapshot.surveyorId)
  } else if (delta.total < 0) {
    // Conservative: only drop when this surveyor no longer contributes totals on the ward.
    if (next.total <= 0 || !surveyorIsActive) {
      activeIds.delete(snapshot.surveyorId)
    }
  }

  await ctx.db.patch(row._id, {
    ...next,
    activeSurveyorIds: [...activeIds],
  })
}

async function applySurveyorCounterDelta(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  snapshot: SurveyAnalyticsSnapshot,
  delta: SurveyStateCounters
) {
  const row = await ensureSurveyorStatsRow(ctx, generation, snapshot)
  const next = {
    total: row.total + delta.total,
    drafts: row.drafts + delta.drafts,
    submitted: row.submitted + delta.submitted,
    qcApproved: row.qcApproved + delta.qcApproved,
    qcRejected: row.qcRejected + delta.qcRejected,
  }
  if (next.total < 0 || next.drafts < 0 || next.submitted < 0 || next.qcApproved < 0 || next.qcRejected < 0) {
    throw new Error("Analytics counter underflow")
  }
  await ctx.db.patch(row._id, next)
}

async function loadSurveyContribution(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  surveyId: Id<"surveys">
): Promise<SurveyAnalyticsSnapshot | null> {
  if (isLegacyGeneration(generation)) return null
  const row = await ctx.db
    .query("surveyAnalyticsContributions")
    .withIndex("by_generation_and_surveyId", (q) => q.eq("generation", generation).eq("surveyId", surveyId))
    .unique()
  if (!row) return null
  return {
    municipalityId: row.municipalityId,
    districtId: row.districtId,
    surveyorId: row.surveyorId,
    wardNo: row.wardNo,
    city: row.city,
    status: row.status,
    qcStatus: row.qcStatus,
    submittedAt: row.submittedAt,
    createdAtMs: row.createdAtMs,
    completionPct: row.completionPct,
  }
}

async function upsertSurveyContribution(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  surveyId: Id<"surveys">,
  snapshot: SurveyAnalyticsSnapshot | null
) {
  if (isLegacyGeneration(generation)) return
  const existing = await ctx.db
    .query("surveyAnalyticsContributions")
    .withIndex("by_generation_and_surveyId", (q) => q.eq("generation", generation).eq("surveyId", surveyId))
    .unique()

  if (!snapshot) {
    if (existing) await ctx.db.delete(existing._id)
    return
  }

  const payload = {
    generation,
    surveyId,
    municipalityId: snapshot.municipalityId,
    districtId: snapshot.districtId,
    surveyorId: snapshot.surveyorId,
    wardNo: snapshot.wardNo ?? "",
    city: snapshot.city,
    status: snapshot.status,
    qcStatus: snapshot.qcStatus,
    submittedAt: snapshot.submittedAt,
    createdAtMs: snapshot.createdAtMs,
    completionPct: snapshot.completionPct,
  }

  if (existing) {
    await ctx.db.replace(existing._id, payload)
  } else {
    await ctx.db.insert("surveyAnalyticsContributions", payload)
  }
}

async function applySurveyTransitionForGeneration(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  surveyId: Id<"surveys">,
  before: SurveyAnalyticsSnapshot | null,
  after: SurveyAnalyticsSnapshot | null
) {
  const contribution = surveyId ? await loadSurveyContribution(ctx, generation, surveyId) : null
  // Prefer last written contribution over the live `before` snapshot so draft-only
  // field/ward edits that skipped rollup writes still reconcile correctly on submit.
  const storedBefore = isLegacyGeneration(generation) ? before : (contribution ?? before)

  if (!after) {
    if (!storedBefore) return
    const removeCounters = countersForSnapshot(storedBefore)
    const negated: SurveyStateCounters = {
      total: -removeCounters.total,
      drafts: -removeCounters.drafts,
      submitted: -removeCounters.submitted,
      qcApproved: -removeCounters.qcApproved,
      qcRejected: -removeCounters.qcRejected,
      qcPending: -removeCounters.qcPending,
    }
    await applyStateCounterDelta(ctx, generation, storedBefore.municipalityId, storedBefore.districtId, negated)
    await applyDailyEventDeltas(
      ctx,
      generation,
      storedBefore.municipalityId,
      dailyEventsForTransition(storedBefore, null)
    )
    await applyWardCounterDelta(ctx, generation, storedBefore, negated)
    await applySurveyorCounterDelta(ctx, generation, storedBefore, negated)
    if (storedBefore.completionPct !== undefined && !shouldSkipCompletionPctRollup(storedBefore, null)) {
      await applyCompletionDelta(ctx, generation, storedBefore.municipalityId, -storedBefore.completionPct, -1)
    }
    await upsertSurveyContribution(ctx, generation, surveyId, null)
    return
  }

  const contributionBefore = storedBefore
  if (contributionBefore && snapshotsEqual(contributionBefore, after)) return

  // Dimension move (municipality / surveyor / ward / district): remove old, add new.
  if (
    contributionBefore &&
    (contributionBefore.municipalityId !== after.municipalityId ||
      contributionBefore.surveyorId !== after.surveyorId ||
      contributionBefore.wardNo !== after.wardNo ||
      contributionBefore.districtId !== after.districtId ||
      contributionBefore.city !== after.city)
  ) {
    const removeCounters = countersForSnapshot(contributionBefore)
    const negated: SurveyStateCounters = {
      total: -removeCounters.total,
      drafts: -removeCounters.drafts,
      submitted: -removeCounters.submitted,
      qcApproved: -removeCounters.qcApproved,
      qcRejected: -removeCounters.qcRejected,
      qcPending: -removeCounters.qcPending,
    }
    await applyStateCounterDelta(
      ctx,
      generation,
      contributionBefore.municipalityId,
      contributionBefore.districtId,
      negated
    )
    await applyDailyEventDeltas(
      ctx,
      generation,
      contributionBefore.municipalityId,
      dailyEventsForTransition(contributionBefore, null)
    )
    await applyWardCounterDelta(ctx, generation, contributionBefore, negated)
    await applySurveyorCounterDelta(ctx, generation, contributionBefore, negated)
    if (contributionBefore.completionPct !== undefined && !shouldSkipCompletionPctRollup(contributionBefore, null)) {
      await applyCompletionDelta(
        ctx,
        generation,
        contributionBefore.municipalityId,
        -contributionBefore.completionPct,
        -1
      )
    }

    const addCounters = countersForSnapshot(after)
    await applyStateCounterDelta(ctx, generation, after.municipalityId, after.districtId, addCounters)
    await applyDailyEventDeltas(ctx, generation, after.municipalityId, dailyEventsForTransition(null, after))
    await applyWardCounterDelta(ctx, generation, after, addCounters)
    await applySurveyorCounterDelta(ctx, generation, after, addCounters)
    if (after.completionPct !== undefined && !shouldSkipCompletionPctRollup(null, after)) {
      await applyCompletionDelta(ctx, generation, after.municipalityId, after.completionPct, 1)
    }
    await upsertSurveyContribution(ctx, generation, surveyId, after)
    return
  }

  const actualCounterDelta = diffSurveyCounters(
    contributionBefore
      ? countersForSnapshot(contributionBefore)
      : {
          total: 0,
          drafts: 0,
          submitted: 0,
          qcApproved: 0,
          qcRejected: 0,
          qcPending: 0,
        },
    countersForSnapshot(after)
  )

  if (
    actualCounterDelta.total ||
    actualCounterDelta.drafts ||
    actualCounterDelta.submitted ||
    actualCounterDelta.qcApproved ||
    actualCounterDelta.qcRejected ||
    actualCounterDelta.qcPending
  ) {
    await applyStateCounterDelta(ctx, generation, after.municipalityId, after.districtId, actualCounterDelta)
    await applyWardCounterDelta(ctx, generation, after, actualCounterDelta)
    await applySurveyorCounterDelta(ctx, generation, after, actualCounterDelta)
  }

  const dailyDeltas = dailyEventsForTransition(contributionBefore, after)
  if (dailyDeltas.length > 0) {
    await applyDailyEventDeltas(ctx, generation, after.municipalityId, dailyDeltas)
  }

  const skipCompletion = shouldSkipCompletionPctRollup(contributionBefore, after)
  if (!skipCompletion) {
    const beforePct = contributionBefore?.completionPct
    const afterPct = after.completionPct
    const afterIsDraft = after.status === "draft"
    // Draft completion is intentionally not rolled into shared municipality counters.
    const beforeWasUnrolledDraft = contributionBefore?.status === "draft"
    if (beforePct !== undefined && !beforeWasUnrolledDraft && (afterIsDraft || beforePct !== afterPct)) {
      await applyCompletionDelta(ctx, generation, after.municipalityId, -beforePct, -1)
    }
    if (afterPct !== undefined && !afterIsDraft && (beforeWasUnrolledDraft || beforePct !== afterPct)) {
      await applyCompletionDelta(ctx, generation, after.municipalityId, afterPct, 1)
    }
  }

  // Contribution rows still store latest completion for backfill/read paths,
  // but draft-only completion churn must not touch shared municipality counters.
  await upsertSurveyContribution(ctx, generation, surveyId, after)
}

/** Canonical survey analytics write path — idempotent per generation via contribution rows. */
export async function applySurveyAnalyticsTransition(
  ctx: MutationCtx,
  surveyId: Id<"surveys">,
  before: Doc<"surveys"> | null,
  after: Doc<"surveys"> | null,
  generations?: WritableGenerations
) {
  const targetGenerations = generations ?? (await writableAnalyticsGenerations(ctx))
  const beforeSnapshot = before ? snapshotFromSurvey(before) : null
  const afterSnapshot = after ? snapshotFromSurvey(after) : null

  for (const generation of targetGenerations) {
    await applySurveyTransitionForGeneration(ctx, generation, surveyId, beforeSnapshot, afterSnapshot)
  }
}

async function ensureQcReviewerStatsRow(
  ctx: MutationCtx,
  generation: AnalyticsGeneration,
  reviewerId: Id<"users">,
  municipalityId: Id<"municipalities">
) {
  if (isLegacyGeneration(generation)) return null
  const existing = await ctx.db
    .query("surveyQcReviewerStats")
    .withIndex("by_generation_and_reviewerId_and_municipalityId", (q) =>
      q.eq("generation", generation).eq("reviewerId", reviewerId).eq("municipalityId", municipalityId)
    )
    .unique()
  if (existing) return existing
  const id = await ctx.db.insert("surveyQcReviewerStats", {
    generation,
    reviewerId,
    municipalityId,
    approved: 0,
    rejected: 0,
    total: 0,
  })
  return (await ctx.db.get(id))!
}

/** Idempotent QC decision aggregate update (reviewer throughput + daily events). */
export async function applyQcDecisionContribution(
  ctx: MutationCtx,
  args: {
    decisionId: Id<"qcDecisions">
    reviewerId: Id<"users">
    municipalityId: Id<"municipalities">
    decision: QcDecisionKind
    decidedAt: number
  },
  generations?: WritableGenerations
) {
  const targetGenerations = generations ?? (await writableAnalyticsGenerations(ctx))

  for (const generation of targetGenerations) {
    if (isLegacyGeneration(generation)) continue

    const existing = await ctx.db
      .query("qcAnalyticsContributions")
      .withIndex("by_generation_and_decisionId", (q) =>
        q.eq("generation", generation).eq("decisionId", args.decisionId)
      )
      .unique()
    if (existing) continue

    const reviewerRow = await ensureQcReviewerStatsRow(ctx, generation, args.reviewerId, args.municipalityId)
    if (!reviewerRow) continue

    const approvedDelta = args.decision === "approve" ? 1 : 0
    const rejectedDelta = args.decision === "reject" ? 1 : 0
    await ctx.db.patch(reviewerRow._id, {
      approved: reviewerRow.approved + approvedDelta,
      rejected: reviewerRow.rejected + rejectedDelta,
      total: reviewerRow.total + 1,
    })

    const dailyEvent = qcDecisionDailyEvent(args.decision, args.decidedAt)
    await applyDailyEventDeltas(ctx, generation, args.municipalityId, [
      {
        dateKey: dailyEvent.dateKey,
        created: 0,
        submitted: 0,
        approved: dailyEvent.approved,
        rejected: dailyEvent.rejected,
      },
    ])

    await ctx.db.insert("qcAnalyticsContributions", {
      generation,
      decisionId: args.decisionId,
      reviewerId: args.reviewerId,
      municipalityId: args.municipalityId,
      decision: args.decision,
      decidedAt: args.decidedAt,
    })
  }
}

/** Convenience wrappers matching legacy call sites. */
export async function recordSurveyAnalyticsInsert(ctx: MutationCtx, survey: Doc<"surveys">) {
  await applySurveyAnalyticsTransition(ctx, survey._id, null, survey)
}

export async function recordSurveyAnalyticsRemove(ctx: MutationCtx, survey: Doc<"surveys">) {
  await applySurveyAnalyticsTransition(ctx, survey._id, survey, null)
}

export async function recordSurveyAnalyticsUpdate(ctx: MutationCtx, before: Doc<"surveys">, after: Doc<"surveys">) {
  const beforeSnap = snapshotFromSurvey(before)
  const afterSnap = snapshotFromSurvey(after)

  // Fast path: no analytics-relevant change (common on draft field edits).
  if (snapshotsEqual(beforeSnap, afterSnap)) return
  if (before.status === "draft" && after.status === "draft" && analyticsDimensionsEqual(beforeSnap, afterSnap)) {
    // Completion-only draft churn — survey.completionPct is already patched;
    // skip shared rollup writes to avoid municipality-row OCC storms.
    return
  }

  await applySurveyAnalyticsTransition(ctx, after._id, before, after)
}
