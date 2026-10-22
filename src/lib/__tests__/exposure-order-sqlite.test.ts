/**
 * Exposures that share an `occurredAt` must come back newest-logged first.
 *
 * Ties are common, not exotic: every backdated row is stored at local midnight
 * of the day the parent named (v0.5.164), so three exposures backdated to
 * yesterday all carry the same instant, and drizzle stores whole seconds. With
 * `ORDER BY occurred_at DESC` alone their order is whatever the planner yields
 * — it can differ between the CSV a therapist reads and the screens, and the
 * dashboard's `LIMIT 10` can drop a different row from one load to the next.
 * Run against real SQL because the tie-break is the planner's, not ours.
 */
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';
import * as schema from '@/src/db/schema';

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import { fetchExportRows } from '../export';

const MIDNIGHT = new Date(2026, 8, 1);

async function log(id: string, foodId: string, createdAt: Date) {
  await mockSqlite.db.insert(schema.exposures).values({
    id,
    childId: 'c1',
    foodId,
    stage: 'touch',
    loggedBy: 'u1',
    occurredAt: MIDNIGHT,
    createdAt,
  });
}

describe('exposures tied on occurredAt', () => {
  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
  });

  // Both insertion orders, so the assertion cannot pass on the planner's
  // accidental (rowid) order in one of them.
  it.each([
    ['older row inserted first', ['old', 'new'] as const],
    ['newer row inserted first', ['new', 'old'] as const],
  ])('the CSV export lists the later-logged row first (%s)', async (_label, order) => {
    const rows = {
      old: () => log('t-old', 'apple', new Date(2026, 8, 2, 9)),
      new: () => log('t-new', 'pear', new Date(2026, 8, 2, 18)),
    };
    for (const key of order) await rows[key]();

    const tied = (await fetchExportRows('c1', 'f1')).filter(
      (r) => r.occurredAt.getTime() === MIDNIGHT.getTime(),
    );
    expect(tied.map((r) => r.foodName)).toEqual(['Pear', 'Apple']);
  });
});
