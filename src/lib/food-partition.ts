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
