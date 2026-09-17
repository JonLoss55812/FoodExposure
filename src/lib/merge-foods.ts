import { eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/src/db/schema';

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
 * before the source row goes.
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

  await db
    .delete(schema.foodChains)
    .where(sql`${schema.foodChains.sourceFoodId} = ${schema.foodChains.targetFoodId}`);

  await db.delete(schema.foods).where(eq(schema.foods.id, sourceFoodId));
}
