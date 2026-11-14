import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'test-utils' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * Tables other rows reference. With foreign keys enforced (v0.5.193), deleting
 * one of these before its dependents throws, so a delete has to go through the
 * dependents-first helpers rather than being written inline in a screen.
 */
const PARENT_TABLES = ['families', 'users', 'children', 'foods'];

/**
 * Where a parent-table delete is allowed, and how many each file may hold.
 * The onboarding one is the rollback of a family row whose user insert just
 * failed, so nothing references it yet.
 */
const ALLOWED: Record<string, number> = {
  'src/lib/cascade-delete.ts': 2,
  'src/lib/merge-foods.ts': 1,
  'app/onboarding/index.tsx': 1,
};

// `.delete(schema.foods)`, `.delete(foods)`, across a line break or not.
const DELETE = new RegExp(`\\.delete\\(\\s*(?:schema\\.)?(${PARENT_TABLES.join('|')})\\s*\\)`, 'g');

describe('parent-table deletes', () => {
  const files = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))];

  it('scans screens and helpers', () => {
    expect(files.map((f) => relative(ROOT, f))).toEqual(
      expect.arrayContaining(['app/food/[id].tsx', 'app/(tabs)/settings.tsx', ...Object.keys(ALLOWED)]),
    );
  });

  it('happen only in the dependents-first helpers and the onboarding rollback', () => {
    const found: Record<string, number> = {};
    for (const file of files) {
      const count = readFileSync(file, 'utf8').match(DELETE)?.length ?? 0;
      if (count > 0) found[relative(ROOT, file)] = count;
    }
    expect(found).toEqual(ALLOWED);
  });
});
