/**
 * Admin draft reassignment — transfer in-progress surveys between field collectors.
 */
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { collectSurveysInFieldScope } from "../shared/fieldAccess"
import { canReadWard, clientError } from "../shared/helpers"
import { resolveTenantScope, tenantMunicipalityIds } from "../shared/tenancy"

const FIELD_COLLECTOR_ROLES = new Set(["surveyor", "supervisor"])

export function isOrphanedAssignee(user: Doc<"users"> | null): boolean {
  if (!user) return true
  if (user.status !== "active") return true
  return !FIELD_COLLECTOR_ROLES.has(user.role)
}

function isTransferableDraft(survey: Doc<"surveys">): boolean {
  return survey.status === "draft"
}

export async function loadTargetSurveyor(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"users">> {
  const target = await ctx.db.get(userId)
  if (!target) clientError("NOT_FOUND", "Target surveyor not found")
  if (target.status !== "active") {
    clientError("BAD_REQUEST", "Target user must be an active account")
  }
  if (!FIELD_COLLECTOR_ROLES.has(target.role)) {
    clientError("BAD_REQUEST", "Target must be a surveyor or field supervisor")
  }
  return target
}

/** Target must cover the survey's ULB and ward (when ward assignments exist). */
export async function assertTargetCoversSurvey(
  ctx: QueryCtx | MutationCtx,
  target: Doc<"users">,
  survey: Doc<"surveys">
): Promise<void> {
  const scope = await resolveTenantScope(ctx, target)
  const muniIds = tenantMunicipalityIds(scope)
  if (!muniIds.has(survey.municipalityId)) {
    clientError("BAD_REQUEST", "Target user is not allotted to this ULB", {
      toSurveyorId: ["assign ULB scope to the target user first"],
    })
  }
  if (!canReadWard(target, survey.municipalityId, survey.wardNo)) {
    clientError("BAD_REQUEST", "Target user is not assigned to this ward", {
      toSurveyorId: ["add ward assignment or broaden target scope"],
    })
  }
}

export async function resolveLocalIdForTransfer(
  ctx: MutationCtx,
  targetId: Id<"users">,
  localId: string,
  surveyId: Id<"surveys">
): Promise<{ localId: string; adjusted: boolean }> {
  const clash = await ctx.db
    .query("surveys")
    .withIndex("by_surveyor_localId", (q) => q.eq("surveyorId", targetId).eq("localId", localId))
    .unique()
  if (!clash || clash._id === surveyId) {
    return { localId, adjusted: false }
  }
  const suffix = surveyId.slice(-6)
  return { localId: `${localId}-xfer-${suffix}`, adjusted: true }
}

export async function collectDraftsInAdminScope(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: {
    districtId?: Id<"districts">
    municipalityId?: Id<"municipalities">
    wardNo?: string
    fromSurveyorId?: Id<"users">
    orphanedOnly?: boolean
  }
): Promise<Doc<"surveys">[]> {
  let rows = (await collectSurveysInFieldScope(ctx, me)).filter(isTransferableDraft)

  if (filters.districtId) {
    rows = rows.filter((r) => r.districtId === filters.districtId)
  }
  if (filters.municipalityId) {
    rows = rows.filter((r) => r.municipalityId === filters.municipalityId)
  }
  if (filters.wardNo) {
    rows = rows.filter((r) => r.wardNo === filters.wardNo)
  }
  if (filters.fromSurveyorId) {
    rows = rows.filter((r) => r.surveyorId === filters.fromSurveyorId)
  }
  if (filters.orphanedOnly) {
    const assigneeIds = [...new Set(rows.map((r) => r.surveyorId))]
    const assignees = await Promise.all(assigneeIds.map((id) => ctx.db.get(id)))
    const orphanedIds = new Set(assigneeIds.filter((id, i) => isOrphanedAssignee(assignees[i] ?? null)))
    rows = rows.filter((r) => orphanedIds.has(r.surveyorId))
  }

  return rows
}

export const draftOwnerRow = v.object({
  surveyorId: v.id("users"),
  name: v.string(),
  email: v.string(),
  role: v.string(),
  status: v.string(),
  draftCount: v.number(),
  isOrphaned: v.boolean(),
})

export const reassignResult = v.object({
  transferred: v.number(),
  skipped: v.number(),
  localIdAdjusted: v.number(),
})

export { isTransferableDraft }
