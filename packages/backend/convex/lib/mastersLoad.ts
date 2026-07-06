import type { Doc } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
/** Load active master rows for the given categories using `by_category_position`. */
export async function loadActiveMastersByCategories(
  ctx: QueryCtx,
  categories: readonly string[]
): Promise<Doc<"masters">[]> {
  const batches = await Promise.all(
    categories.map((category) =>
      ctx.db
        .query("masters")
        .withIndex("by_category_position", (q) => q.eq("category", category).eq("isActive", true))
        .collect()
    )
  )
  return batches.flat()
}

/** Load active master rows for a single category. */
export async function loadActiveMastersByCategory(ctx: QueryCtx, category: string): Promise<Doc<"masters">[]> {
  const rows = await ctx.db
    .query("masters")
    .withIndex("by_category_position", (q) => q.eq("category", category).eq("isActive", true))
    .collect()
  return rows
}
