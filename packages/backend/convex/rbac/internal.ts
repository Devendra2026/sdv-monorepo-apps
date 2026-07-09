import { internalMutation } from "../_generated/server"
import { ensureRbacSeededIfEmpty } from "./helpers"

/** Idempotent bootstrap — seeds permissions/roles when the catalog is empty. */
export const ensureSeeded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const seeded = await ensureRbacSeededIfEmpty(ctx)
    return { seeded }
  },
})
