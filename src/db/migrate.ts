import { MIGRATION_SQL, REPAIR_ORPHANS_SQL } from './migration';

/**
 * The slice of a SQLite connection the runner needs. expo-sqlite's database
 * satisfies it as-is; the tests wrap `node:sqlite` in the same two methods.
 */
export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

/**
 * Numbered schema steps. Step N (1-based) runs once, on any install whose
 * `PRAGMA user_version` is below N, and the version is bumped to N in the same
 * transaction.
 *
 * Step 1 is the baseline schema. It is `IF NOT EXISTS` throughout, so it is
 * also safe on installs created before this runner existed: those sit at
 * user_version 0 with every table already present, and step 1 only adds what
 * they lack (the v0.5.170 indexes, on the oldest ones).
 *
 * **Append, never edit.** An install that has already run a step will never
 * run it again, so a change to an existing step reaches fresh installs only —
 * exactly the forward-only trap the v0.5.123–v0.5.131 CHECK constraints fell
 * into. A new column is a new step: `ALTER TABLE … ADD COLUMN …`.
 */
export const MIGRATIONS: readonly string[] = [
  MIGRATION_SQL,
  // 2: repair orphan rows so foreign keys can be enforced (v0.5.193).
  REPAIR_ORPHANS_SQL,
];

/**
 * Applies every step above the database's `user_version`, in order, each in
 * its own transaction. Returns the version the database is at afterwards.
 *
 * A failed step is rolled back — its DDL and its version bump together — and
 * the error rethrown, so a retry starts from the last step that fully applied.
 * A database already *ahead* of the list (an app downgrade) is left alone.
 */
export async function runMigrations(
  db: MigrationDb,
  migrations: readonly string[] = MIGRATIONS
): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < migrations.length) {
    const next = version + 1;
    try {
      await db.execAsync(`BEGIN;\n${migrations[version]}\nPRAGMA user_version = ${next};\nCOMMIT;`);
    } catch (err) {
      try {
        await db.execAsync('ROLLBACK;');
      } catch {
        // No open transaction (the failure was in BEGIN itself); nothing to undo.
      }
      throw err;
    }
    version = next;
  }

  return version;
}
