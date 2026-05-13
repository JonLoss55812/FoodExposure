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

type FoodFilterable = { name: string; category: string };

export function filterFoods<T extends FoodFilterable>(
  foods: readonly T[],
  search: string | null | undefined,
  category: string | null | undefined,
): T[] {
  // Defensive coercion at the helper boundary: the form-state callers
  // (foods.tsx searchQuery + selectedCategory) provably pass strings
  // today, but the helper is exported and a future caller — a deep-link
  // query-param parser, a CSV import path, a rehydrated MMKV blob whose
  // schema drifted — could deliver null/undefined/number. Without the
  // guard, `search.trim()` throws TypeError and crashes the Foods tab
  // render. Same defense-in-depth class as v0.5.118/v0.5.119 (non-string
  // displayName/childName guards) — every public helper boundary is
  // provably safe regardless of upstream gating.
  const safeSearch = typeof search === 'string' ? search : '';
  const safeCategory = typeof category === 'string' ? category : 'all';
  const needle = safeSearch.trim().toLowerCase();
  const all = safeCategory === 'all';
  if (!needle && all) return foods.slice();
  return foods.filter((food) => {
    const matchesSearch = !needle || food.name.toLowerCase().includes(needle);
    const matchesCategory = all || food.category === safeCategory;
    return matchesSearch && matchesCategory;
  });
}

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

export function computeStageCounts(
  exposures: readonly ExposureForFood[],
): Record<string, number> {
  const byFood = new Map<string, ExposureForFood[]>();
  for (const exp of exposures) {
    const existing = byFood.get(exp.foodId);
    if (existing) existing.push(exp);
    else byFood.set(exp.foodId, [exp]);
  }
  const counts: Record<string, number> = {};
  for (const foodExposures of byFood.values()) {
    const highest = getHighestStage(foodExposures);
    if (!highest) continue;
    counts[highest] = (counts[highest] ?? 0) + 1;
  }
  return counts;
}
