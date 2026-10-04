/**
 * A real drizzle instance over an in-memory `node:sqlite` database, with the
 * shipped migrations applied.
 *
 * `createMockDb()` records writes but never evaluates a `where` predicate, so a
 * helper that deletes the wrong rows — or deletes in an order a constraint
 * rejects — passes against it. This one runs the actual SQL drizzle generates,
 * through drizzle's `sqlite-proxy` driver (there is no first-party node:sqlite
 * driver in drizzle 0.45), so the rows left behind are the assertion.
 *
 * Foreign keys default to **on**, so a dependents-first ordering is actually
 * exercised. Note that `node:sqlite` enables them by default where expo-sqlite
 * does not — pass `{ foreignKeys: false }` to model a connection without them.
 */
import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from '@/src/db/schema';
import { MIGRATIONS } from '@/src/db/migrate';

export function createSqliteDb({ foreignKeys = true }: { foreignKeys?: boolean } = {}) {
  const raw = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  for (const step of MIGRATIONS) raw.exec(step);
  raw.exec(`PRAGMA foreign_keys = ${foreignKeys ? 'ON' : 'OFF'};`);

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = raw.prepare(sql);
      const args = params as SQLInputValue[];
      if (method === 'run') {
        stmt.run(...args);
        return { rows: [] };
      }
      if (method === 'get') {
        const row = stmt.get(...args);
        return { rows: row ? Object.values(row) : [] };
      }
      return { rows: stmt.all(...args).map((row) => Object.values(row)) };
    },
    { schema }
  );

  /** Ids in a table, sorted — the usual shape of an assertion here. */
  const ids = (table: string, where = '1 = 1'): string[] =>
    (raw.prepare(`SELECT id FROM ${table} WHERE ${where} ORDER BY id`).all() as { id: string }[]).map(
      (r) => r.id
    );

  return { raw, db, ids };
}

/**
 * Seeds two families' worth of rows by raw SQL (so the fixture does not depend
 * on drizzle's timestamp encoding): family `f1` with children `c1`/`c2` and
 * foods `apple`/`pear`, and an unrelated family `f2` with child `c9` and foods
 * `kiwi`/`fig`, so a predicate that over-matches deletes something visible.
 */
export function seedTwoFamilies(raw: DatabaseSync) {
  raw.exec(`
    INSERT INTO families (id, name, invite_code, created_at) VALUES
      ('f1', 'One', 'ABCDEF', 1), ('f2', 'Two', 'GHJKLM', 1);
    INSERT INTO users (id, family_id, email, display_name, created_at) VALUES
      ('u1', 'f1', 'a@x.app', 'A', 1);
    INSERT INTO children (id, family_id, name, created_at) VALUES
      ('c1', 'f1', 'Emma', 1), ('c2', 'f1', 'Leo', 1), ('c9', 'f2', 'Other', 1);
    INSERT INTO foods (id, family_id, name, category, created_at) VALUES
      ('apple', 'f1', 'Apple', 'fruit', 1), ('pear', 'f1', 'Pear', 'fruit', 1),
      ('kiwi', 'f2', 'Kiwi', 'fruit', 1), ('fig', 'f2', 'Fig', 'fruit', 1);
    INSERT INTO exposures (id, child_id, food_id, stage, logged_by, occurred_at, created_at) VALUES
      ('e1', 'c1', 'apple', 'touch', 'u1', 10, 1),
      ('e2', 'c2', 'apple', 'smell', 'u1', 11, 1),
      ('e3', 'c1', 'pear', 'eat', 'u1', 12, 1),
      ('e9', 'c9', 'kiwi', 'eat', NULL, 13, 1);
    INSERT INTO food_chains (id, child_id, source_food_id, target_food_id, created_at) VALUES
      ('ch1', 'c1', 'apple', 'pear', 1),
      ('ch2', 'c2', 'pear', 'apple', 1),
      ('ch9', 'c9', 'kiwi', 'fig', 1);
  `);
}
