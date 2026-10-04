/**
 * The versioned runner against a real (in-memory) SQLite database, via
 * `node:sqlite` — same harness as `migration.test.ts`. The properties that
 * matter are the ones a mocked connection cannot show: that `user_version`
 * actually persists, and that a failed step's DDL is really rolled back.
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS, MigrationDb, runMigrations } from '../migrate';
import { MIGRATION_SQL, REPAIR_ORPHANS_SQL } from '../migration';

function adapter(db: DatabaseSync): MigrationDb {
  return {
    execAsync: async (source) => {
      db.exec(source);
    },
    getFirstAsync: async <T,>(source: string) => (db.prepare(source).get() as T) ?? null,
  };
}

function userVersion(db: DatabaseSync): number {
  return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

function hasTable(db: DatabaseSync, name: string): boolean {
  return (
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name) !==
    undefined
  );
}

function columns(db: DatabaseSync, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => r.name as string);
}

describe('runMigrations', () => {
  it('the shipped list starts with the baseline schema', () => {
    expect(MIGRATIONS[0]).toBe(MIGRATION_SQL);
  });

  it('brings a fresh database to the latest version with the schema in place', async () => {
    const db = new DatabaseSync(':memory:');
    await expect(runMigrations(adapter(db))).resolves.toBe(MIGRATIONS.length);
    expect(userVersion(db)).toBe(MIGRATIONS.length);
    expect(hasTable(db, 'exposures')).toBe(true);
  });

  it('adopts an install created before the runner existed, keeping its rows', async () => {
    // Pre-runner installs ran MIGRATION_SQL directly and never set user_version.
    const db = new DatabaseSync(':memory:');
    db.exec(MIGRATION_SQL);
    db.exec(`INSERT INTO families (id, name, invite_code, created_at) VALUES ('f1', 'Fam', 'ABC234', 1)`);
    expect(userVersion(db)).toBe(0);

    await runMigrations(adapter(db));

    expect(userVersion(db)).toBe(MIGRATIONS.length);
    expect(db.prepare('SELECT COUNT(*) AS n FROM families').get()).toEqual({ n: 1 });
  });

  it('runs each step once, so a relaunch applies nothing', async () => {
    const db = new DatabaseSync(':memory:');
    const steps = ['CREATE TABLE log (n INTEGER);', 'INSERT INTO log VALUES (2);'];

    await runMigrations(adapter(db), steps);
    await runMigrations(adapter(db), steps);

    expect(db.prepare('SELECT COUNT(*) AS n FROM log').get()).toEqual({ n: 1 });
  });

  it('applies only the steps above the stored version, in order', async () => {
    const db = new DatabaseSync(':memory:');
    await runMigrations(adapter(db), [MIGRATION_SQL]);
    expect(columns(db, 'foods')).not.toContain('updated_at');

    // What the next real schema change will look like: a new step, not an edit.
    const next = [MIGRATION_SQL, 'ALTER TABLE foods ADD COLUMN updated_at INTEGER;'];
    await expect(runMigrations(adapter(db), next)).resolves.toBe(2);

    expect(columns(db, 'foods')).toContain('updated_at');
    expect(userVersion(db)).toBe(2);
  });

  it('rolls a failed step back whole and leaves the version where it was', async () => {
    const db = new DatabaseSync(':memory:');
    await runMigrations(adapter(db), ['CREATE TABLE a (x INTEGER);']);

    const broken = [
      'CREATE TABLE a (x INTEGER);',
      'CREATE TABLE b (x INTEGER); INSERT INTO missing VALUES (1);',
    ];
    await expect(runMigrations(adapter(db), broken)).rejects.toThrow(/missing/);

    expect(userVersion(db)).toBe(1);
    expect(hasTable(db, 'b')).toBe(false);

    // The connection is usable again, and a fixed step applies on retry.
    const fixed = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (x INTEGER);'];
    await expect(runMigrations(adapter(db), fixed)).resolves.toBe(2);
    expect(hasTable(db, 'b')).toBe(true);
  });

  it('stops at the first failing step, keeping the ones before it', async () => {
    const db = new DatabaseSync(':memory:');
    const steps = ['CREATE TABLE a (x INTEGER);', 'BROKEN SQL;', 'CREATE TABLE c (x INTEGER);'];

    await expect(runMigrations(adapter(db), steps)).rejects.toThrow();

    expect(userVersion(db)).toBe(1);
    expect(hasTable(db, 'a')).toBe(true);
    expect(hasTable(db, 'c')).toBe(false);
  });

  it('leaves a database that is ahead of the list (an app downgrade) alone', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA user_version = 5;');

    await expect(runMigrations(adapter(db), ['CREATE TABLE a (x INTEGER);'])).resolves.toBe(5);

    expect(userVersion(db)).toBe(5);
    expect(hasTable(db, 'a')).toBe(false);
  });
});

describe('step 2: repairing orphans so foreign keys can be enforced', () => {
  /** A v1 install (baseline applied) that accumulated orphans with FKs off. */
  function v1WithOrphans(): DatabaseSync {
    const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
    db.exec(MIGRATION_SQL);
    db.exec('PRAGMA user_version = 1;');
    db.exec(`
      INSERT INTO families (id, name, invite_code, created_at) VALUES ('f1', 'Ours', 'ABC234', 1);
      INSERT INTO users (id, family_id, email, display_name, created_at) VALUES
        ('u1', 'f1', 'a@x.app', 'A', 1), ('u2', 'ghost-fam', 'b@x.app', 'B', 1);
      INSERT INTO children (id, family_id, name, created_at) VALUES
        ('c1', 'f1', 'Emma', 1), ('c2', 'ghost-fam', 'Leo', 1);
      INSERT INTO foods (id, family_id, name, category, created_at) VALUES
        ('apple', 'f1', 'Apple', 'fruit', 1), ('pear', 'ghost-fam', 'Pear', 'fruit', 1);
      INSERT INTO exposures (id, child_id, food_id, stage, logged_by, occurred_at, created_at) VALUES
        ('ok', 'c1', 'apple', 'eat', 'u1', 5, 1),
        ('ghost-logger', 'c1', 'apple', 'eat', 'gone-user', 5, 1),
        ('ghost-child', 'gone-child', 'apple', 'eat', 'u1', 5, 1),
        ('ghost-food', 'c1', 'gone-food', 'eat', 'u1', 5, 1),
        ('orphan-fam-row', 'c2', 'pear', 'eat', 'u2', 5, 1);
      INSERT INTO food_chains (id, child_id, source_food_id, target_food_id, created_at) VALUES
        ('ch-ok', 'c1', 'apple', 'pear', 1),
        ('ch-child', 'gone-child', 'apple', 'pear', 1),
        ('ch-source', 'c1', 'gone-food', 'pear', 1),
        ('ch-target', 'c1', 'apple', 'gone-food', 1);
    `);
    return db;
  }

  const ids = (db: DatabaseSync, table: string) =>
    (db.prepare(`SELECT id FROM ${table} ORDER BY id`).all() as { id: string }[]).map((r) => r.id);

  it('is the second step', () => {
    expect(MIGRATIONS[1]).toBe(REPAIR_ORPHANS_SQL);
  });

  it('leaves no foreign-key violation behind', async () => {
    const db = v1WithOrphans();
    expect(db.prepare('PRAGMA foreign_key_check').all().length).toBeGreaterThan(0);

    await expect(runMigrations(adapter(db))).resolves.toBe(2);

    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('re-creates a missing family instead of deleting the rows that point at it', async () => {
    const db = v1WithOrphans();
    await runMigrations(adapter(db));

    expect(ids(db, 'families')).toEqual(['f1', 'ghost-fam']);
    // The pre-existing family is untouched.
    expect(db.prepare(`SELECT name, invite_code FROM families WHERE id = 'f1'`).get()).toEqual({
      name: 'Ours',
      invite_code: 'ABC234',
    });
    expect(ids(db, 'children')).toEqual(['c1', 'c2']);
    expect(ids(db, 'foods')).toEqual(['apple', 'pear']);
    expect(ids(db, 'users')).toEqual(['u1', 'u2']);
  });

  it('clears a dangling logged_by but keeps the exposure', async () => {
    const db = v1WithOrphans();
    await runMigrations(adapter(db));

    expect(
      db.prepare(`SELECT id, logged_by FROM exposures WHERE id IN ('ok', 'ghost-logger') ORDER BY id`).all()
    ).toEqual([
      { id: 'ghost-logger', logged_by: null },
      { id: 'ok', logged_by: 'u1' },
    ]);
  });

  it('deletes exposures and chains whose child or food is gone, and only those', async () => {
    const db = v1WithOrphans();
    await runMigrations(adapter(db));

    expect(ids(db, 'exposures')).toEqual(['ghost-logger', 'ok', 'orphan-fam-row']);
    expect(ids(db, 'food_chains')).toEqual(['ch-ok']);
  });

  it('changes nothing on a clean database', async () => {
    const db = new DatabaseSync(':memory:');
    await runMigrations(adapter(db), [MIGRATION_SQL]);
    db.exec(`
      INSERT INTO families (id, name, invite_code, created_at) VALUES ('f1', 'Ours', 'ABC234', 1);
      INSERT INTO children (id, family_id, name, created_at) VALUES ('c1', 'f1', 'Emma', 1);
    `);

    await runMigrations(adapter(db));

    expect(ids(db, 'families')).toEqual(['f1']);
    expect(ids(db, 'children')).toEqual(['c1']);
  });
});
