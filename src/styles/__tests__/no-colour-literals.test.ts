import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

/**
 * Every colour a screen or component paints must come from the theme.
 * v0.5.153–v0.5.156 removed the last hard-coded literals; a new one would
 * skip dark mode and contrast.test.ts alike. The per-screen theme tests catch
 * this only on the elements they happen to pin; this catches it everywhere.
 */
describe('colour literals', () => {
  const files = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))];

  it('scans the screens and components', () => {
    expect(files.map((f) => relative(ROOT, f))).toEqual(
      expect.arrayContaining(['app/food/[id].tsx', 'src/components/Button.tsx']),
    );
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))('%s has no hex or rgb() colour literal', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/["'`]#[0-9a-fA-F]{3,8}["'`]/);
    expect(source).not.toMatch(/["'`]rgba?\(/);
  });
});
