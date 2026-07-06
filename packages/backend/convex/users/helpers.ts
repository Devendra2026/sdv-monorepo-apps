import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { writeAudit } from "../shared/helpers"

const ALLOWED_REQUESTED_ROLES = new Set(["surveyor", "supervisor"])
const MAX_REQUESTED_REASON_LEN = 500

/** Only surveyor/supervisor may be requested at sign-up; ignore spoofed values. */
export function normalizeSignupMetadata(input: { requestedRole?: string; requestedReason?: string }): {
  requestedRole?: string
  requestedReason?: string
} {
  const requestedRole =
    input.requestedRole && ALLOWED_REQUESTED_ROLES.has(input.requestedRole) ? input.requestedRole : undefined
  const trimmed = input.requestedReason?.trim()
  const requestedReason = trimmed && trimmed.length > 0 ? trimmed.slice(0, MAX_REQUESTED_REASON_LEN) : undefined
  return { requestedRole, requestedReason }
}

interface UpsertUserArgs {
  clerkId: string
  email: string
  name: string
  avatarUrl?: string
  requestedRole?: string
  requestedReason?: string
}

/**
 * Create or update the domain user row. Webhook updates always apply signup
 * metadata; client provisioning only fills `requested*` when still empty.
 */
export async function upsertUserRecord(
  ctx: MutationCtx,
  args: UpsertUserArgs,
  opts: { fillSignupMetadataOnlyIfEmpty: boolean }
): Promise<Id<"users">> {
  const meta = normalizeSignupMetadata(args)
  const normalized: UpsertUserArgs = { ...args, ...meta }

  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", normalized.clerkId))
    .unique()

  if (existing) {
    const patch: {
      email: string
      name: string
      avatarUrl?: string
      requestedRole?: string
      requestedReason?: string
    } = {
      email: normalized.email,
      name: normalized.name,
      avatarUrl: normalized.avatarUrl,
    }

    if (opts.fillSignupMetadataOnlyIfEmpty) {
      if (normalized.requestedRole && !existing.requestedRole) {
        patch.requestedRole = normalized.requestedRole
      }
      if (normalized.requestedReason && !existing.requestedReason) {
        patch.requestedReason = normalized.requestedReason
      }
    } else {
      if (normalized.requestedRole !== undefined) patch.requestedRole = normalized.requestedRole
      if (normalized.requestedReason !== undefined) {
        patch.requestedReason = normalized.requestedReason
      }
    }

    await ctx.db.patch(existing._id, patch)
    return existing._id
  }

  const userId = await ctx.db.insert("users", {
    clerkId: normalized.clerkId,
    email: normalized.email,
    name: normalized.name,
    avatarUrl: normalized.avatarUrl,
    role: "pending",
    status: "pending_approval",
    wardAssignments: [],
    requestedRole: normalized.requestedRole,
    requestedReason: normalized.requestedReason,
  })

  await writeAudit(ctx, {
    action: "user.created",
    entity: "user",
    entityId: userId,
    metadata: { clerkId: normalized.clerkId, email: normalized.email, source: "provision" },
  })

  return userId
}
