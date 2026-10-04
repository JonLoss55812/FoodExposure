/**
 * The destructive helpers against real SQL with foreign keys enforced.
 *
 * `cascade-delete.test.ts` and `merge-foods.test.ts` pin the step order and
 * each predicate *object* against a recording fake. What they cannot show is
 * what that SQL does to rows: that a predicate deletes exactly the rows it
 * names and nothing in another family, and that the dependents-first order is
 * one a FK-enforcing connection actually accepts. These run the helpers
 * through a real drizzle instance (`src/test-utils/sqlite-db.ts`).
 */
import { eq } from 'drizzle-orm';

import * as schema from '@/src/db/schema';
import { deleteChildCascade, deleteFoodCascade } from '../cascade-delete';
import { mergeFoods } from '../merge-foods';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';

function setup() {
  const h = createSqliteDb();
  seedTwoFamilies(h.raw);
  return h;
}

function fkViolations(h: ReturnType<typeof setup>): unknown[] {
  return h.raw.prepare('PRAGMA foreign_key_check').all();
}

describe('destructive helpers against real SQLite (foreign keys on)', () => {
  it('deleteFoodCascade removes the food, its exposures and chains in both columns, and nothing else', async () => {
    const h = setup();
    await deleteFoodCascade(h.db, 'apple');

    expect(h.ids('foods')).toEqual(['fig', 'kiwi', 'pear']);
    expect(h.ids('exposures')).toEqual(['e3', 'e9']);
    // ch1 has apple as source, ch2 as target — both must go.
    expect(h.ids('food_chains')).toEqual(['ch9']);
    expect(fkViolations(h)).toEqual([]);
  });

  it('deleteChildCascade removes the child and its rows, leaving siblings and other families', async () => {
    const h = setup();
    await deleteChildCascade(h.db, 'c1');

    expect(h.ids('children')).toEqual(['c2', 'c9']);
    expect(h.ids('exposures')).toEqual(['e2', 'e9']);
    expect(h.ids('food_chains')).toEqual(['ch2', 'ch9']);
    expect(h.ids('foods')).toEqual(['apple', 'fig', 'kiwi', 'pear']);
    expect(fkViolations(h)).toEqual([]);
  });

  it('mergeFoods moves every exposure onto the survivor, sweeps the resulting self-chains, and deletes the twin', async () => {
    const h = setup();
    await mergeFoods(h.db, 'apple', 'pear');

    expect(h.ids('foods')).toEqual(['fig', 'kiwi', 'pear']);
    expect(h.ids('exposures')).toEqual(['e1', 'e2', 'e3', 'e9']);
    expect(h.ids('exposures', "food_id = 'pear'")).toEqual(['e1', 'e2', 'e3']);
    // apple->pear and pear->apple both become pear->pear and are swept.
    expect(h.ids('food_chains')).toEqual(['ch9']);
    expect(fkViolations(h)).toEqual([]);
  });

  it('a parent-first delete is rejected by the constraint, which is what the dependents-first order avoids', async () => {
    // Guards the premise of the tests above: if foreign keys were silently off
    // in this harness, the ordering would be untested.
    const h = setup();
    const err = await h.db
      .delete(schema.foods)
      .where(eq(schema.foods.id, 'apple'))
      .then(() => null, (e: Error) => e);
    // drizzle wraps the driver error; the constraint message is on `cause`.
    expect(String((err as Error & { cause?: unknown })?.cause)).toMatch(/FOREIGN KEY/);
    expect(h.ids('foods')).toContain('apple');
  });
});
