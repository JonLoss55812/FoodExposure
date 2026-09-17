import { eq } from 'drizzle-orm';
import * as schema from '@/src/db/schema';
import { mergeFoods } from '../merge-foods';
import type { MergeFoodsDb } from '../merge-foods';

interface RecordedOp {
  kind: 'update' | 'delete';
  table: unknown;
  values?: unknown;
  condition: unknown;
}

function makeDb(failOnCall?: number) {
  const calls: RecordedOp[] = [];
  const record = (op: RecordedOp) => {
    calls.push(op);
    if (failOnCall !== undefined && calls.length === failOnCall) {
      throw new Error('simulated sqlite failure');
    }
  };
  const db: MergeFoodsDb = {
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: async (condition: unknown) => {
          record({ kind: 'update', table, values, condition });
          return undefined;
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async (condition: unknown) => {
        record({ kind: 'delete', table, condition });
        return undefined;
      },
    }),
  } as unknown as MergeFoodsDb;
  return { db, calls };
}

describe('mergeFoods', () => {
  it('reassigns dependents before removing the source food row', async () => {
    const { db, calls } = makeDb();
    await mergeFoods(db, 'dup', 'keep');

    // Source row goes last: a mid-sequence failure must leave a retryable
    // state, never rows whose parent is already gone.
    expect(calls.map((c) => `${c.kind}:${c.table === schema.foods ? 'foods' : c.table === schema.exposures ? 'exposures' : 'foodChains'}`)).toEqual([
      'update:exposures',
      'update:foodChains',
      'update:foodChains',
      'delete:foodChains',
      'delete:foods',
    ]);
  });

  it('moves every exposure to the surviving food', async () => {
    const { db, calls } = makeDb();
    await mergeFoods(db, 'dup', 'keep');

    // The whole point of merging over deleting: the twin's exposures are the
    // history the 15/20/30 acceptance threshold is counted from.
    expect(calls[0].values).toEqual({ foodId: 'keep' });
    // Regression lock on the direction. Swapping source and target here would
    // silently move the *surviving* food's exposures onto the row about to be
    // deleted, destroying both halves of the history.
    expect(calls[0].condition).toEqual(eq(schema.exposures.foodId, 'dup'));
  });

  it('rewrites both food_chains FK columns, each scoped to its own column', async () => {
    const { db, calls } = makeDb();
    await mergeFoods(db, 'dup', 'keep');

    expect(calls[1].values).toEqual({ sourceFoodId: 'keep' });
    expect(calls[1].condition).toEqual(eq(schema.foodChains.sourceFoodId, 'dup'));
    expect(calls[2].values).toEqual({ targetFoodId: 'keep' });
    expect(calls[2].condition).toEqual(eq(schema.foodChains.targetFoodId, 'dup'));
  });

  it('sweeps the self-referential chains the rewrite can create', async () => {
    const { db, calls } = makeDb();
    await mergeFoods(db, 'dup', 'keep');

    // A legitimate "dup -> keep" chain becomes "keep -> keep" once both
    // columns are rewritten, which means nothing. Without this step the merge
    // leaves that garbage row behind.
    expect(calls[3].kind).toBe('delete');
    expect(calls[3].table).toBe(schema.foodChains);
    expect(calls[3].condition).toBeTruthy();
  });

  it('deletes the source food row and only that row', async () => {
    const { db, calls } = makeDb();
    await mergeFoods(db, 'dup', 'keep');

    const last = calls[calls.length - 1];
    expect(last.kind).toBe('delete');
    expect(last.table).toBe(schema.foods);
    expect(last.condition).toEqual(eq(schema.foods.id, 'dup'));
  });

  it('stops at the failing step so the source food survives a mid-sequence failure', async () => {
    const { db, calls } = makeDb(1);
    await expect(mergeFoods(db, 'dup', 'keep')).rejects.toThrow('simulated sqlite failure');

    // Nothing past the failure ran, so the source row is still there to retry
    // against — no half-merged state with a missing parent.
    expect(calls).toHaveLength(1);
  });

  it('does not reach the source delete when a later reassignment fails', async () => {
    const { db, calls } = makeDb(3);
    await expect(mergeFoods(db, 'dup', 'keep')).rejects.toThrow('simulated sqlite failure');

    expect(calls).toHaveLength(3);
    expect(calls.some((c) => c.kind === 'delete' && c.table === schema.foods)).toBe(false);
  });

  it('refuses to merge a food into itself without touching the database', async () => {
    const { db, calls } = makeDb();
    // The last step deletes the source row. Merging into self would therefore
    // reassign every exposure to a row it is about to delete.
    await expect(mergeFoods(db, 'same', 'same')).rejects.toThrow('into itself');
    expect(calls).toHaveLength(0);
  });

  it('rejects blank or non-string ids on either side without touching the database', async () => {
    for (const bad of ['', '   ', null, undefined, 42, {}]) {
      const a = makeDb();
      await expect(
        mergeFoods(a.db, bad as unknown as string, 'keep')
      ).rejects.toThrow('sourceFoodId');
      expect(a.calls).toHaveLength(0);

      const b = makeDb();
      await expect(
        mergeFoods(b.db, 'dup', bad as unknown as string)
      ).rejects.toThrow('targetFoodId');
      expect(b.calls).toHaveLength(0);
    }
  });
});
