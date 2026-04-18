import { partitionSafeFoods } from '../food-partition';

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
