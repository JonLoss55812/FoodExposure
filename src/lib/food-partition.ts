import { type ExposureStage } from './constants';
import { getHighestStage } from './stage';

export type SafeFoodish = { isSafeFood: boolean };

export function partitionSafeFoods<T extends SafeFoodish>(
  foods: readonly T[],
): { safeFoods: T[]; otherFoods: T[] } {
  const safeFoods: T[] = [];
  const otherFoods: T[] = [];
  for (const food of foods) {
    if (food.isSafeFood) safeFoods.push(food);
    else otherFoods.push(food);
  }
  return { safeFoods, otherFoods };
}

export type EmptyStateKind = 'none' | 'filtered' | 'has-results';

export function getEmptyStateKind(
  totalCount: number,
  filteredCount: number,
): EmptyStateKind {
  if (totalCount === 0) return 'none';
  if (filteredCount === 0) return 'filtered';
  return 'has-results';
}

type FoodIdentifiable = { id: string };
type ExposureForFood = { foodId: string; stage: string };

export type FoodStats = {
  exposureCount: number;
  highestStage?: ExposureStage;
};

export function buildFoodsWithStats<T extends FoodIdentifiable>(
  foods: readonly T[],
  exposures: readonly ExposureForFood[],
): (T & FoodStats)[] {
  const byFood = new Map<string, ExposureForFood[]>();
  for (const exp of exposures) {
    const existing = byFood.get(exp.foodId);
    if (existing) existing.push(exp);
    else byFood.set(exp.foodId, [exp]);
  }
  return foods.map((food) => {
    const foodExposures = byFood.get(food.id) ?? [];
    const highest = getHighestStage(foodExposures);
    return {
      ...food,
      exposureCount: foodExposures.length,
      highestStage: highest ?? undefined,
    };
  });
}
