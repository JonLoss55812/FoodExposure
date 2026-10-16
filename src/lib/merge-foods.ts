import { and, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/src/db/schema';
import { getCategoryConfig } from '@/src/lib/constants';

/**
 * Minimal structural type for the drizzle update+delete builders the merge
 * uses. Declared locally — matching `CascadeDeleteDb` in `cascade-delete.ts`
 * and for the same reason — so the helper can be unit-tested against a fake
 * runner rather than a real expo-sqlite database.
 */
export interface MergeFoodsDb {
  update: <TTable extends SQLiteTable>(
    table: TTable
  ) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: SQL | undefined) => PromiseLike<unknown>;
    };
  };
  delete: <TTable extends SQLiteTable>(
    table: TTable
  ) => { where: (condition: SQL | undefined) => PromiseLike<unknown> };
}

/**
 * Fold one food row into another, keeping every exposure.
 *
 * v0.5.136 blocks *new* duplicate food names, but a family that accumulated
 * "Brocolli" and "Broccoli" before that guard existed had no lossless way out:
 * the v0.5.145 rename refuses a colliding name (by design — a rename must not
 * be a back door around the uniqueness guard), and the only removal path,
 * `deleteFoodCascade`, discards every exposure logged against the twin. That
 * is the exact history the 15/20/30 acceptance threshold is counted from, so
 * "fixing" the typo cost the evidence. Merging reassigns instead of deleting.
 *
 * Order is load-bearing and is dependents-first for the same reason as
 * `deleteFoodCascade`: the source `foods` row is removed **last**, so a
 * mid-sequence failure leaves a retryable state (some exposures already point
 * at the target, the source row still exists) rather than orphaned rows whose
 * parent is gone.
 *
 * Step 4 is not bookkeeping. `food_chains` references `foods` twice, so
 * rewriting both columns can turn a legitimate source->target chain into a
 * self-referential `target -> target` row that means nothing. Those are swept
 * before the source row goes — only the survivor's, never another family's.
 *
 * Step 5 carries the twin's food-level fields onto the survivor where that
 * loses nothing: it stays a safe food if **either** row was one (otherwise
 * merging a pinned twin into an unflagged one silently un-pins the child's
 * preferred food), and it takes the twin's default preparation only when it
 * never recorded its own. Name and category stay the survivor's — the parent
 * picked that row deliberately.
 */
export async function mergeFoods(
  db: MergeFoodsDb,
  sourceFoodId: string,
  targetFoodId: string
): Promise<void> {
  if (typeof sourceFoodId !== 'string' || sourceFoodId.trim().length === 0) {
    throw new Error('mergeFoods: sourceFoodId must be a non-empty string');
  }
  if (typeof targetFoodId !== 'string' || targetFoodId.trim().length === 0) {
    throw new Error('mergeFoods: targetFoodId must be a non-empty string');
  }
  // Without this the last step would delete the row every exposure was just
  // reassigned to — a merge-into-self would destroy the whole food.
  if (sourceFoodId === targetFoodId) {
    throw new Error('mergeFoods: cannot merge a food into itself');
  }

  await db
    .update(schema.exposures)
    .set({ foodId: targetFoodId })
    .where(eq(schema.exposures.foodId, sourceFoodId));

  await db
    .update(schema.foodChains)
    .set({ sourceFoodId: targetFoodId })
    .where(eq(schema.foodChains.sourceFoodId, sourceFoodId));

  await db
    .update(schema.foodChains)
    .set({ targetFoodId: targetFoodId })
    .where(eq(schema.foodChains.targetFoodId, sourceFoodId));

  // Scoped to the survivor: the rewrite can only create `target -> target`
  // rows, and an unscoped `source = target` would also delete other
  // families' rows.
  await db
    .delete(schema.foodChains)
    .where(
      and(
        eq(schema.foodChains.sourceFoodId, targetFoodId),
        eq(schema.foodChains.targetFoodId, targetFoodId)
      )
    );

  // One statement, so the survivor is never left half-updated. The subqueries
  // read the source row, which still exists until the next step.
  await db
    .update(schema.foods)
    .set({
      isSafeFood: sql`max("is_safe_food", coalesce((select "merge_src"."is_safe_food" from "foods" as "merge_src" where "merge_src"."id" = ${sourceFoodId}), 0))`,
      defaultPreparation: sql`coalesce("default_preparation", (select "merge_src"."default_preparation" from "foods" as "merge_src" where "merge_src"."id" = ${sourceFoodId}))`,
    })
    .where(eq(schema.foods.id, targetFoodId));

  await db.delete(schema.foods).where(eq(schema.foods.id, sourceFoodId));
}

/**
 * The last sentence of a merge confirm. `mergeFoods` keeps the survivor's
 * category and discards the twin's, so when the two disagree "Nothing is
 * lost" is false — the confirm names both categories instead. Missing or
 * equal categories keep the plain promise (the exposures, safe-food flag and
 * preparation are all carried over).
 */
export function describeMergeOutcome(
  source: { category?: string | null },
  target: { name: string; category?: string | null },
): string {
  const from = source.category;
  const to = target.category;
  if (!from || !to || from === to) return 'Nothing is lost.';
  return `Every exposure is kept, but "${target.name}" stays filed under ${getCategoryConfig(to).label} — the ${getCategoryConfig(from).label} category is not carried over.`;
}
