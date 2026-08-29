import { eq, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/src/db/schema';

/**
 * Minimal structural type for the drizzle delete builder the cascades use.
 * Declared locally (rather than importing the concrete expo-sqlite database
 * type) so these helpers can be unit-tested against a fake runner — the whole
 * point of extracting them out of the screen handlers.
 */
export interface CascadeDeleteDb {
  delete: <TTable extends SQLiteTable>(
    table: TTable
  ) => { where: (condition: SQL | undefined) => PromiseLike<unknown> };
}

/**
 * Delete a food and every row that references it, dependents first.
 *
 * Order is load-bearing: `food_chains` and `exposures` both carry FK
 * references to `foods`, so deleting the parent first would either fail on a
 * FK-enforcing connection or orphan child rows on a non-enforcing one. Going
 * dependents-first means a mid-sequence failure leaves a retryable state (the
 * food is still present, some dependents are gone) rather than orphans.
 *
 * `food_chains` references `foods` twice (source and target), so both columns
 * have to be swept — matching on only one leaves dangling chain rows.
 */
export async function deleteFoodCascade(db: CascadeDeleteDb, foodId: string): Promise<void> {
  if (typeof foodId !== 'string' || foodId.trim().length === 0) {
    throw new Error('deleteFoodCascade: foodId must be a non-empty string');
  }

  await db.delete(schema.foodChains).where(
    or(eq(schema.foodChains.sourceFoodId, foodId), eq(schema.foodChains.targetFoodId, foodId))
  );
  await db.delete(schema.exposures).where(eq(schema.exposures.foodId, foodId));
  await db.delete(schema.foods).where(eq(schema.foods.id, foodId));
}

/**
 * Delete a child and every row that references them, dependents first.
 * Same ordering contract as {@link deleteFoodCascade}.
 */
export async function deleteChildCascade(db: CascadeDeleteDb, childId: string): Promise<void> {
  if (typeof childId !== 'string' || childId.trim().length === 0) {
    throw new Error('deleteChildCascade: childId must be a non-empty string');
  }

  await db.delete(schema.foodChains).where(eq(schema.foodChains.childId, childId));
  await db.delete(schema.exposures).where(eq(schema.exposures.childId, childId));
  await db.delete(schema.children).where(eq(schema.children.id, childId));
}
