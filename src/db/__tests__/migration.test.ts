/**
 * Executes the shipped migration against a real (in-memory) SQLite database.
 *
 * Until this file, the entire data layer was untested: the migration lived in a
 * template literal inside a React component that no test imported, which is how
 * v0.5.170 shipped a stray backtick that terminated the literal while all 777
 * tests stayed green. Only `tsc` caught it.
 *
 * `node:sqlite` (Node 22+) is used rather than expo-sqlite because it needs no
 * native module and speaks the same SQL dialect, so the assertions below are
 * about the script, not about the driver.
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATION_SQL } from '../migration';

const TABLES = ['families', 'users', 'children', 'foods', 'exposures', 'food_chains'] as const;

const INDEXES = [
  'idx_exposures_child_occurred',
  'idx_exposures_child_food_occurred',
  'idx_exposures_food',
] as const;

function migrated(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION_SQL);
  return db;
}

function tableNames(db: DatabaseSync): string[] {
  return db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
    .all()
    .map((r) => r.name as string);
}

/** Seeds the one family / child / food every exposures-row insert needs. */
function seedParents(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO families (id, name, invite_code, created_at) VALUES ('f1', 'Fam', 'ABC234', 1);
    INSERT INTO children (id, family_id, name, created_at) VALUES ('c1', 'f1', 'Emma', 1);
    INSERT INTO foods (id, family_id, name, category, created_at)
      VALUES ('fd1', 'f1', 'Apple', 'fruit', 1);
  `);
}

/** Inserts an exposure, overriding any column, so a single CHECK can be driven. */
function insertExposure(db: DatabaseSync, overrides: Record<string, unknown> = {}): void {
  const row: Record<string, unknown> = {
    id: 'e1',
    child_id: 'c1',
    food_id: 'fd1',
    stage: 'taste',
    occurred_at: 1,
    created_at: 1,
    ...overrides,
  };
  const cols = Object.keys(row);
  db.prepare(
    `INSERT INTO exposures (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).run(...(Object.values(row) as never[]));
}

describe('MIGRATION_SQL', () => {
  it('runs cleanly against a fresh database and creates all six tables', () => {
    const db = migrated();

    // Exact set, not a subset: a stray CREATE TABLE typo that produced a
    // seventh table (or a table the drizzle schema does not know about) is as
    // much a defect as a missing one.
    expect(tableNames(db)).toEqual([...TABLES].sort());

    db.close();
  });

  it('is idempotent — running it twice is a no-op, not an error', () => {
    // This is the load-bearing property of the whole script: it executes on
    // every single cold start, not once at install.
    const db = new DatabaseSync(':memory:');
    db.exec(MIGRATION_SQL);
    expect(() => db.exec(MIGRATION_SQL)).not.toThrow();

    expect(tableNames(db)).toEqual([...TABLES].sort());
    db.close();
  });

  it('preserves existing rows when re-run', () => {
    // A second run must not recreate (and therefore empty) a table — the
    // `IF NOT EXISTS` on every statement is what stands between an upgrade and
    // total data loss, so pin it rather than trusting it by inspection.
    const db = migrated();
    seedParents(db);
    insertExposure(db);

    db.exec(MIGRATION_SQL);

    expect(db.prepare(`SELECT COUNT(*) AS n FROM exposures`).get()!.n).toBe(1);
    db.close();
  });

  it('creates the three v0.5.170 exposures indexes', () => {
    const db = migrated();

    const names = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'`)
      .all()
      .map((r) => r.name as string);

    expect(names.sort()).toEqual([...INDEXES].sort());
    db.close();
  });

  it.each([
    [
      "the dashboard's Today's Exposures count",
      `SELECT COUNT(*) FROM exposures WHERE child_id = 'c1' AND occurred_at >= 0`,
      'idx_exposures_child_occurred',
    ],
    [
      "the dashboard's recent-10 list",
      `SELECT id FROM exposures WHERE child_id = 'c1' ORDER BY occurred_at DESC LIMIT 10`,
      'idx_exposures_child_occurred',
    ],
    [
      "the food detail page's per-child history",
      `SELECT id FROM exposures WHERE child_id = 'c1' AND food_id = 'fd1' ORDER BY occurred_at DESC`,
      'idx_exposures_child_food_occurred',
    ],
    [
      "deleteFoodCascade's exposures sweep",
      `DELETE FROM exposures WHERE food_id = 'fd1'`,
      'idx_exposures_food',
    ],
  ])('the planner uses the right index for %s', (_label, sql, expectedIndex) => {
    // The indexes existing is not the point — the point is that the planner
    // picks the *intended* one for the query each call site emits. v0.5.170
    // measured a regression from an index that looked obviously right:
    // (child_id, food_id) with no occurred_at made the planner prefer
    // idx_exposures_child_occurred for the ORDER BY and then filter, scanning
    // every one of that child's rows. A plan assertion that only says "some
    // index" passes under exactly that mutation (verified), so name the index.
    const db = migrated();
    const plan = db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all()
      .map((r) => r.detail as string)
      .join(' | ');

    expect(plan).toMatch(new RegExp(`USING (COVERING )?INDEX ${expectedIndex}\\b`));
    expect(plan).not.toMatch(/SCAN exposures\b(?! USING)/);
    db.close();
  });

  describe('CHECK constraints reject out-of-contract rows', () => {
    it('rejects an invite code that is not exactly six characters', () => {
      const db = migrated();
      const insert = (code: string) =>
        db
          .prepare(`INSERT INTO families (id, name, invite_code, created_at) VALUES (?, ?, ?, 1)`)
          .run(code, 'Fam', code);

      expect(() => insert('ABC23')).toThrow(/CHECK constraint/i);
      expect(() => insert('ABC2345')).toThrow(/CHECK constraint/i);
      expect(() => insert('ABC234')).not.toThrow();
      db.close();
    });

    it.each([
      ['a child name over 50 characters', 'a'.repeat(51)],
      ['an empty child name', ''],
    ])('rejects %s', (_label, name) => {
      const db = migrated();
      db.exec(`INSERT INTO families (id, name, invite_code, created_at)
                 VALUES ('f1', 'Fam', 'ABC234', 1)`);

      expect(() =>
        db
          .prepare(`INSERT INTO children (id, family_id, name, created_at) VALUES ('c1','f1',?,1)`)
          .run(name)
      ).toThrow(/CHECK constraint/i);
      db.close();
    });

    it('rejects a food category outside the six-value enum', () => {
      const db = migrated();
      db.exec(`INSERT INTO families (id, name, invite_code, created_at)
                 VALUES ('f1', 'Fam', 'ABC234', 1)`);

      expect(() =>
        db
          .prepare(
            `INSERT INTO foods (id, family_id, name, category, created_at)
               VALUES ('fd1','f1','Lentils',?,1)`
          )
          .run('legume')
      ).toThrow(/CHECK constraint/i);
      db.close();
    });

    it.each([
      // Each of these is a value the Zod layer rejects at the form boundary but
      // that a future ingest path (Convex sync, CSV import) could deliver.
      ['a rating of 0', { rating: 0 }],
      ['a rating of 6', { rating: 6 }],
      ['an unknown stage', { stage: 'mystery' }],
      ['an unknown temperature', { temperature: 'tepid' }],
      ['an unknown texture', { texture: 'gritty' }],
      ['an unknown meal type', { meal_type: 'brunch' }],
      ['an unknown setting', { setting: 'park' }],
      ['an epoch-zero occurred_at', { occurred_at: 0 }],
      ['a negative occurred_at', { occurred_at: -1 }],
      ['an epoch-zero created_at', { created_at: 0 }],
    ])('rejects %s on exposures', (_label, overrides) => {
      const db = migrated();
      seedParents(db);

      expect(() => insertExposure(db, overrides)).toThrow(/CHECK constraint/i);
      db.close();
    });

    it('accepts the inclusive rating boundaries and every enum value', () => {
      // The mirror of the rejection cases: a CHECK narrowed one step too far
      // (`rating BETWEEN 2 AND 4`, or an enum missing a member) would silently
      // make the most clinically meaningful values un-loggable.
      const db = migrated();
      seedParents(db);

      for (const [i, rating] of [1, 5].entries()) {
        expect(() => insertExposure(db, { id: `r${i}`, rating })).not.toThrow();
      }
      for (const stage of ['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat']) {
        expect(() => insertExposure(db, { id: `s-${stage}`, stage })).not.toThrow();
      }
      for (const temperature of ['hot', 'warm', 'room', 'cold']) {
        expect(() => insertExposure(db, { id: `t-${temperature}`, temperature })).not.toThrow();
      }
      for (const setting of ['home', 'school', 'restaurant', 'therapy']) {
        expect(() => insertExposure(db, { id: `g-${setting}`, setting })).not.toThrow();
      }
      db.close();
    });

    it('leaves every optional exposure dimension nullable', () => {
      // "Not recorded" is a legal state for rating/notes/preparation and the
      // four enum dimensions — the app writes `?? null` for each, and the
      // v0.5.168/169 editors clear back to null. A CHECK without an
      // `IS NULL` escape would make a bare exposure un-insertable.
      const db = migrated();
      seedParents(db);

      expect(() => insertExposure(db)).not.toThrow();

      const row = db.prepare(`SELECT * FROM exposures WHERE id = 'e1'`).get()!;
      for (const col of [
        'rating',
        'preparation',
        'temperature',
        'texture',
        'meal_type',
        'setting',
        'notes',
        'logged_by',
        'synced_at',
      ]) {
        expect(row[col]).toBeNull();
      }
      db.close();
    });

    it('defaults is_safe_food to 0 and rejects any value outside (0, 1)', () => {
      const db = migrated();
      db.exec(`INSERT INTO families (id, name, invite_code, created_at)
                 VALUES ('f1', 'Fam', 'ABC234', 1)`);
      const insert = (id: string, v: number) =>
        db
          .prepare(
            `INSERT INTO foods (id, family_id, name, category, is_safe_food, created_at)
               VALUES (?,'f1','Apple','fruit',?,1)`
          )
          .run(id, v);

      // 2 is the load-bearing case: drizzle's boolean mode reads any non-zero
      // as true, but `eq(foods.isSafeFood, true)` compiles to `= 1` — so such a
      // row would show in the pinned Safe Foods row and vanish from every
      // filtered query. Read-vs-filter drift, silent by construction.
      expect(() => insert('bad', 2)).toThrow(/CHECK constraint/i);
      expect(() => insert('neg', -1)).toThrow(/CHECK constraint/i);

      db.exec(`INSERT INTO foods (id, family_id, name, category, created_at)
                 VALUES ('fd1','f1','Apple','fruit',1)`);
      expect(db.prepare(`SELECT is_safe_food AS v FROM foods WHERE id = 'fd1'`).get()!.v).toBe(0);
      db.close();
    });
  });
});
