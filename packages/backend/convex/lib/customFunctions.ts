/**
 * Reusable auth wrappers — Convex is the authorization source of truth.
 */
import { customMutation, customQuery } from "convex-helpers/server/customFunctions"
import type { Doc } from "../_generated/dataModel"
import { mutation, query } from "../_generated/server"
import { requireCapability } from "../shared/capabilities"
import { requireUser } from "../shared/helpers"

export type AuthedUser = Doc<"users">

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx, args) => {
    const user = await requireUser(ctx)
    return { ctx: { ...ctx, user }, args }
  },
})

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx, args) => {
    const user = await requireUser(ctx)
    return { ctx: { ...ctx, user }, args }
  },
})

/** Query wrapper that requires an active user with the given capability. */
export function capabilityQuery(capability: string) {
  return customQuery(query, {
    args: {},
    input: async (ctx, args) => {
      const user = await requireUser(ctx)
      await requireCapability(ctx, user, capability)
      return { ctx: { ...ctx, user }, args }
    },
  })
}

/** Mutation wrapper that requires an active user with the given capability. */
export function capabilityMutation(capability: string) {
  return customMutation(mutation, {
    args: {},
    input: async (ctx, args) => {
      const user = await requireUser(ctx)
      await requireCapability(ctx, user, capability)
      return { ctx: { ...ctx, user }, args }
    },
  })
}
