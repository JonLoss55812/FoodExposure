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

type FoodNameable = { name: string; id?: string };

/**
 * Case-insensitive, whitespace-trimmed duplicate lookup for the Add Food
 * flow. Adding "apple" when "Apple" already exists creates a second food
 * row, and every per-food stat (exposure count vs. threshold, highest
 * stage, safe-food pinning) silently splits across the duplicates — the
 * exposure-count-toward-acceptance metric undercounts on both rows.
 * Same intra-family-uniqueness defect class v0.5.91 closed for users.
 * Blank/whitespace-only candidates never match: the schema's .min(1)
 * owns that rejection. Returns the first colliding row so the caller
 * can name it in the alert.
 *
 * `excludeId` skips one row by id, which the rename flow needs: renaming
 * "Brocolli" to "Broccoli" must not collide with the row being renamed,
 * and a case-only fix ("apple" -> "Apple") would otherwise be rejected as
 * a duplicate of itself. Blank/non-string excludeId behaves as no exclusion.
 */
export function findDuplicateFood<T extends FoodNameable>(
  foods: readonly T[],
  name: string | null | undefined,
  excludeId?: string | null,
): T | undefined {
  if (typeof name !== 'string') return undefined;
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  const skipId = typeof excludeId === 'string' && excludeId.trim() ? excludeId : null;
  return foods.find(
    (food) =>
      food.id !== skipId &&
      typeof food.name === 'string' &&
      food.name.trim().toLowerCase() === needle,
  );
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

/**
 * Repair a form's selected food id against a freshly-loaded food list.
 *
 * The Log Exposure form holds `foodId` in react-hook-form state, which
 * outlives a focus reload of the food list. If the selected food was deleted
 * from another screen (the v0.5.138 Delete Food flow), the id would survive in
 * the form with no matching chip rendered — and submitting would insert an
 * exposure row pointing at a food that no longer exists.
 *
 * Returns the id unchanged when it still resolves, and `''` (the form's
 * "nothing selected" default) when it does not. A blank/non-string id is
 * already "nothing selected", so it normalizes to `''` too.
 */
export function resolveSelectedFoodId<T extends FoodIdentifiable>(
  foods: readonly T[],
  selectedFoodId: string | null | undefined,
): string {
  if (typeof selectedFoodId !== 'string' || selectedFoodId.length === 0) return '';
  return foods.some((food) => food.id === selectedFoodId) ? selectedFoodId : '';
}
