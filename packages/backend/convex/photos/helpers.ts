import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export async function deleteStorageIfPresent(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  try {
    await ctx.storage.delete(storageId)
  } catch {
    // blob may already be deleted
  }
}
