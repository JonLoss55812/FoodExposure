import {
  partitionSafeFoods,
  getEmptyStateKind,
  buildFoodsWithStats,
  filterFoods,
  computeStageCounts,
} from '../food-partition';

type F = { id: string; name: string; isSafeFood: boolean };

const mk = (id: string, isSafeFood: boolean, name = id): F => ({ id, name, isSafeFood });

describe('partitionSafeFoods', () => {
  it('returns empty arrays for empty input', () => {
    expect(partitionSafeFoods([])).toEqual({ safeFoods: [], otherFoods: [] });
  });

  it('splits safe and non-safe foods preserving order', () => {
    const list = [mk('a', false), mk('b', true), mk('c', false), mk('d', true)];
    const { safeFoods, otherFoods } = partitionSafeFoods(list);
    expect(safeFoods.map((f) => f.id)).toEqual(['b', 'd']);
    expect(otherFoods.map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('returns all in otherFoods when none are safe', () => {
    const list = [mk('a', false), mk('b', false)];
    expect(partitionSafeFoods(list)).toEqual({ safeFoods: [], otherFoods: list });
  });

  it('returns all in safeFoods when every entry is safe', () => {
    const list = [mk('a', true), mk('b', true)];
    expect(partitionSafeFoods(list)).toEqual({ safeFoods: list, otherFoods: [] });
  });

  it('coerces truthy non-boolean isSafeFood values', () => {
    const list = [
      { id: 'a', name: 'a', isSafeFood: 1 as unknown as boolean },
      { id: 'b', name: 'b', isSafeFood: 0 as unknown as boolean },
      { id: 'c', name: 'c', isSafeFood: null as unknown as boolean },
    ];
    const { safeFoods, otherFoods } = partitionSafeFoods(list);
    expect(safeFoods.map((f) => f.id)).toEqual(['a']);
    expect(otherFoods.map((f) => f.id)).toEqual(['b', 'c']);
  });
});

describe('buildFoodsWithStats', () => {
  type Food = { id: string; name: string; category: string };
  const food = (id: string, name = id): Food => ({ id, name, category: 'fruit' });

  it('returns empty array when no foods are passed', () => {
    expect(buildFoodsWithStats([], [])).toEqual([]);
  });

  it('returns foods with zero exposureCount and undefined highestStage when exposures empty', () => {
    const result = buildFoodsWithStats([food('a'), food('b')], []);
    expect(result).toEqual([
      { id: 'a', name: 'a', category: 'fruit', exposureCount: 0, highestStage: undefined },
      { id: 'b', name: 'b', category: 'fruit', exposureCount: 0, highestStage: undefined },
    ]);
  });

  it('counts exposures per food and tracks the highest reached stage', () => {
    const exposures = [
      { foodId: 'a', stage: 'tolerate' },
      { foodId: 'a', stage: 'taste' },
      { foodId: 'a', stage: 'smell' },
      { foodId: 'b', stage: 'eat' },
    ];
    const result = buildFoodsWithStats([food('a'), food('b'), food('c')], exposures);
    expect(result[0]).toMatchObject({ id: 'a', exposureCount: 3, highestStage: 'taste' });
    expect(result[1]).toMatchObject({ id: 'b', exposureCount: 1, highestStage: 'eat' });
    expect(result[2]).toMatchObject({ id: 'c', exposureCount: 0, highestStage: undefined });
  });

  it('skips unknown stage strings when computing highestStage', () => {
    const exposures = [
      { foodId: 'a', stage: 'mystery' },
      { foodId: 'a', stage: 'smell' },
      { foodId: 'a', stage: 'bogus' },
    ];
    const result = buildFoodsWithStats([food('a')], exposures);
    expect(result[0]).toMatchObject({ exposureCount: 3, highestStage: 'smell' });
  });

  it('returns undefined highestStage when every exposure has an unknown stage', () => {
    const exposures = [
      { foodId: 'a', stage: 'mystery' },
      { foodId: 'a', stage: 'bogus' },
    ];
    const result = buildFoodsWithStats([food('a')], exposures);
    expect(result[0]).toMatchObject({ exposureCount: 2, highestStage: undefined });
  });

  it('preserves food order from the input list', () => {
    const result = buildFoodsWithStats(
      [food('z'), food('a'), food('m')],
      [{ foodId: 'a', stage: 'eat' }],
    );
    expect(result.map((f) => f.id)).toEqual(['z', 'a', 'm']);
  });

  it('ignores exposures whose foodId does not match any food', () => {
    const result = buildFoodsWithStats(
      [food('a')],
      [
        { foodId: 'a', stage: 'taste' },
        { foodId: 'orphan', stage: 'eat' },
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'a', exposureCount: 1, highestStage: 'taste' });
  });
});

describe('getEmptyStateKind', () => {
  it('returns "none" when no foods exist at all', () => {
    expect(getEmptyStateKind(0, 0)).toBe('none');
  });

  it('returns "filtered" when foods exist but filter yields zero', () => {
    expect(getEmptyStateKind(5, 0)).toBe('filtered');
  });

  it('returns "has-results" when filter yields at least one match', () => {
    expect(getEmptyStateKind(5, 3)).toBe('has-results');
  });

  it('returns "has-results" when every food matches the filter', () => {
    expect(getEmptyStateKind(5, 5)).toBe('has-results');
  });
});

describe('computeStageCounts', () => {
  it('returns an empty object when no exposures are passed', () => {
    expect(computeStageCounts([])).toEqual({});
  });

  it('counts each food once at its highest reached stage', () => {
    const exposures = [
      { foodId: 'a', stage: 'tolerate' },
      { foodId: 'a', stage: 'taste' },
      { foodId: 'a', stage: 'smell' },
      { foodId: 'b', stage: 'eat' },
      { foodId: 'c', stage: 'touch' },
    ];
    expect(computeStageCounts(exposures)).toEqual({
      taste: 1,
      eat: 1,
      touch: 1,
    });
  });

  it('aggregates multiple foods reaching the same highest stage', () => {
    const exposures = [
      { foodId: 'a', stage: 'taste' },
      { foodId: 'b', stage: 'taste' },
      { foodId: 'b', stage: 'tolerate' },
      { foodId: 'c', stage: 'eat' },
    ];
    expect(computeStageCounts(exposures)).toEqual({ taste: 2, eat: 1 });
  });

  it('skips foods whose every exposure has an unknown stage', () => {
    const exposures = [
      { foodId: 'a', stage: 'mystery' },
      { foodId: 'a', stage: 'bogus' },
      { foodId: 'b', stage: 'eat' },
    ];
    expect(computeStageCounts(exposures)).toEqual({ eat: 1 });
  });

  it('uses the highest known stage when unknown stages are mixed in', () => {
    const exposures = [
      { foodId: 'a', stage: 'mystery' },
      { foodId: 'a', stage: 'smell' },
      { foodId: 'a', stage: 'bogus' },
    ];
    expect(computeStageCounts(exposures)).toEqual({ smell: 1 });
  });
});

describe('filterFoods', () => {
  type Item = { id: string; name: string; category: string };
  const apple = { id: '1', name: 'Apple', category: 'fruit' };
  const broccoli = { id: '2', name: 'Broccoli', category: 'vegetable' };
  const bread = { id: '3', name: 'Bread', category: 'grain' };
  const banana = { id: '4', name: 'Banana', category: 'fruit' };
  const list: Item[] = [apple, broccoli, bread, banana];

  it('returns every food when search is empty and category is "all"', () => {
    expect(filterFoods(list, '', 'all')).toEqual(list);
  });

  it('returns a copy, not the same reference, on the no-op path', () => {
    const result = filterFoods(list, '', 'all');
    expect(result).not.toBe(list);
    expect(result).toEqual(list);
  });

  it('matches name case-insensitively', () => {
    expect(filterFoods(list, 'APP', 'all').map((f) => f.id)).toEqual(['1']);
    expect(filterFoods(list, 'app', 'all').map((f) => f.id)).toEqual(['1']);
  });

  it('matches anywhere in the name (substring)', () => {
    expect(filterFoods(list, 'an', 'all').map((f) => f.id)).toEqual(['4']);
  });

  it('filters by category when search is empty', () => {
    expect(filterFoods(list, '', 'fruit').map((f) => f.id)).toEqual(['1', '4']);
  });

  it('combines search and category (AND)', () => {
    expect(filterFoods(list, 'b', 'fruit').map((f) => f.id)).toEqual(['4']);
    expect(filterFoods(list, 'b', 'grain').map((f) => f.id)).toEqual(['3']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterFoods(list, 'xyz', 'all')).toEqual([]);
    expect(filterFoods(list, '', 'dairy')).toEqual([]);
  });

  it('treats whitespace-only search as empty (no narrowing)', () => {
    expect(filterFoods(list, '   ', 'all')).toEqual(list);
  });

  it('returns empty for an empty input list', () => {
    expect(filterFoods([], 'apple', 'all')).toEqual([]);
  });
});
