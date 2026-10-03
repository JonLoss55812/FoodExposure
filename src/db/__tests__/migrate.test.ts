/**
 * The versioned runner against a real (in-memory) SQLite database, via
 * `node:sqlite` — same harness as `migration.test.ts`. The properties that
 * matter are the ones a mocked connection cannot show: that `user_version`
 * actually persists, and that a failed step's DDL is really rolled back.
 */
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS, MigrationDb, runMigrations } from '../migrate';
import { MIGRATION_SQL } from '../migration';

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

    expect(userVersion(db)).toBe(1);
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
