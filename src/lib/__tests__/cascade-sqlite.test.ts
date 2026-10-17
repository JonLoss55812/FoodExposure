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

  it("mergeFoods sweeps only the survivor's self-chains, not another family's", async () => {
    const h = setup();
    // A self-chain in family f2 (kiwi -> kiwi). Meaningless, but it is f2's
    // row: a merge inside f1 has no business deleting it.
    h.raw.exec(
      "INSERT INTO food_chains (id, child_id, source_food_id, target_food_id, created_at) VALUES ('ch8', 'c9', 'kiwi', 'kiwi', 1)"
    );
    await mergeFoods(h.db, 'apple', 'pear');

    expect(h.ids('food_chains')).toEqual(['ch8', 'ch9']);
    expect(fkViolations(h)).toEqual([]);
  });

  // v0.5.211: the survivor used to keep only its own food-level fields, so
  // folding a safe-food twin into an unflagged one silently un-pinned the
  // child's preferred food. Both reductions are lossless: safe if either was,
  // and the survivor's preparation unless it never recorded one.
  function foodRow(h: ReturnType<typeof setup>, id: string) {
    return h.raw
      .prepare('SELECT is_safe_food AS safe, default_preparation AS prep FROM foods WHERE id = ?')
      .get(id) as { safe: number; prep: string | null };
  }

  it('mergeFoods keeps the safe-food flag when only the twin carried it', async () => {
    const h = setup();
    h.raw.exec("UPDATE foods SET is_safe_food = 1, default_preparation = 'steamed' WHERE id = 'apple'");
    await mergeFoods(h.db, 'apple', 'pear');

    expect(foodRow(h, 'pear')).toEqual({ safe: 1, prep: 'steamed' });
    // Scoped to the survivor: no other family's food is flagged or filled.
    expect(foodRow(h, 'kiwi')).toEqual({ safe: 0, prep: null });
    expect(fkViolations(h)).toEqual([]);
  });

  it("mergeFoods keeps the survivor's own safe flag and preparation", async () => {
    const h = setup();
    h.raw.exec("UPDATE foods SET is_safe_food = 1, default_preparation = 'raw' WHERE id = 'pear'");
    h.raw.exec("UPDATE foods SET default_preparation = 'steamed' WHERE id = 'apple'");
    await mergeFoods(h.db, 'apple', 'pear');

    expect(foodRow(h, 'pear')).toEqual({ safe: 1, prep: 'raw' });
  });

  it('mergeFoods gives the survivor the spelling the parent typed', async () => {
    const h = setup();
    await mergeFoods(h.db, 'apple', 'pear', { survivorName: 'PEAR' });

    const row = h.raw.prepare('SELECT name FROM foods WHERE id = ?').get('pear') as { name: string };
    expect(row.name).toBe('PEAR');
  });

  it('mergeFoods leaves an unflagged pair unflagged', async () => {
    const h = setup();
    await mergeFoods(h.db, 'apple', 'pear');

    expect(foodRow(h, 'pear')).toEqual({ safe: 0, prep: null });
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
