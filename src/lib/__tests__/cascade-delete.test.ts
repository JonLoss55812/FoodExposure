import { eq, or } from 'drizzle-orm';
import * as schema from '@/src/db/schema';
import { deleteFoodCascade, deleteChildCascade } from '../cascade-delete';
import type { CascadeDeleteDb } from '../cascade-delete';

interface RecordedDelete {
  table: unknown;
  condition: unknown;
}

function makeDb(failOnCall?: number) {
  const calls: RecordedDelete[] = [];
  const db: CascadeDeleteDb = {
    delete: (table: unknown) => ({
      where: async (condition: unknown) => {
        calls.push({ table, condition });
        if (failOnCall !== undefined && calls.length === failOnCall) {
          throw new Error('simulated sqlite failure');
        }
        return undefined;
      },
    }),
  };
  return { db, calls };
}

describe('deleteFoodCascade', () => {
  it('deletes dependents before the food row', async () => {
    const { db, calls } = makeDb();
    await deleteFoodCascade(db, 'food-1');

    expect(calls.map((c) => c.table)).toEqual([
      schema.foodChains,
      schema.exposures,
      schema.foods,
    ]);
  });

  it('sweeps both food_chains FK columns and scopes each delete to the food id', async () => {
    const { db, calls } = makeDb();
    await deleteFoodCascade(db, 'food-1');

    // food_chains references foods twice — matching only one column would
    // leave dangling chain rows pointing at a deleted food.
    expect(calls[0].condition).toEqual(
      or(
        eq(schema.foodChains.sourceFoodId, 'food-1'),
        eq(schema.foodChains.targetFoodId, 'food-1')
      )
    );
    // Regression lock on the catastrophic typo: filtering exposures by
    // childId (or omitting the filter) would wipe unrelated rows.
    expect(calls[1].condition).toEqual(eq(schema.exposures.foodId, 'food-1'));
    expect(calls[2].condition).toEqual(eq(schema.foods.id, 'food-1'));
  });

  it('stops at the failing step so the food row survives a mid-sequence failure', async () => {
    const { db, calls } = makeDb(1);

    await expect(deleteFoodCascade(db, 'food-1')).rejects.toThrow('simulated sqlite failure');
    expect(calls).toHaveLength(1);
    expect(calls.map((c) => c.table)).not.toContain(schema.foods);
  });

  it('rejects an empty or non-string id before issuing any delete', async () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
      const { db, calls } = makeDb();
      await expect(deleteFoodCascade(db, bad as unknown as string)).rejects.toThrow(
        /non-empty string/
      );
      expect(calls).toHaveLength(0);
    }
  });
});

describe('deleteChildCascade', () => {
  it('deletes dependents before the child row', async () => {
    const { db, calls } = makeDb();
    await deleteChildCascade(db, 'child-1');

    expect(calls.map((c) => c.table)).toEqual([
      schema.foodChains,
      schema.exposures,
      schema.children,
    ]);
  });

  it('scopes each delete to the child id', async () => {
    const { db, calls } = makeDb();
    await deleteChildCascade(db, 'child-1');

    expect(calls[0].condition).toEqual(eq(schema.foodChains.childId, 'child-1'));
    expect(calls[1].condition).toEqual(eq(schema.exposures.childId, 'child-1'));
    expect(calls[2].condition).toEqual(eq(schema.children.id, 'child-1'));
  });

  it('stops at the failing step so the child row survives a mid-sequence failure', async () => {
    const { db, calls } = makeDb(2);

    await expect(deleteChildCascade(db, 'child-1')).rejects.toThrow('simulated sqlite failure');
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.table)).not.toContain(schema.children);
  });

  it('rejects an empty or non-string id before issuing any delete', async () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
      const { db, calls } = makeDb();
      await expect(deleteChildCascade(db, bad as unknown as string)).rejects.toThrow(
        /non-empty string/
      );
      expect(calls).toHaveLength(0);
    }
  });
});
