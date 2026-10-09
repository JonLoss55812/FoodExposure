/**
 * The real-SQL harness has to hand drizzle rows the way the app's driver
 * does — positionally. It used to return node:sqlite's row objects through
 * `Object.values`, which silently drops a column whenever two selected
 * columns share a name, so every field after the duplicate shifted by one.
 */
import { eq } from 'drizzle-orm';
import * as schema from '@/src/db/schema';
import { createSqliteDb, seedTwoFamilies } from '../sqlite-db';

describe('createSqliteDb', () => {
  it('keeps both columns when a join selects two columns named `name`', async () => {
    const { db, raw } = createSqliteDb();
    seedTwoFamilies(raw);

    const rows = await db
      .select({
        foodName: schema.foods.name,
        childName: schema.children.name,
        stage: schema.exposures.stage,
      })
      .from(schema.exposures)
      .innerJoin(schema.foods, eq(schema.exposures.foodId, schema.foods.id))
      .innerJoin(schema.children, eq(schema.exposures.childId, schema.children.id))
      .where(eq(schema.exposures.id, 'e9'));

    expect(rows).toEqual([{ foodName: 'Kiwi', childName: 'Other', stage: 'eat' }]);
  });

  it('returns a single positional row for `.get()`', async () => {
    const { db, raw } = createSqliteDb();
    seedTwoFamilies(raw);

    const row = await db
      .select({ id: schema.children.id, name: schema.children.name })
      .from(schema.children)
      .where(eq(schema.children.id, 'c9'))
      .get();

    expect(row).toEqual({ id: 'c9', name: 'Other' });
  });
});
