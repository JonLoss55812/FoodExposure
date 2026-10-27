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
 * A placeholder colour must come from the theme. The literal `#94A3B8` that
 * six inputs used is 2.56:1 on white, and the Search foods box has no visible
 * label for the placeholder to lean on. `theme.colors.textTertiary` clears AA
 * on `inputBackground` in both themes (contrast.test.ts).
 */
describe('placeholderTextColor', () => {
  const files = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))];

  it('scans the screens that render text inputs', () => {
    expect(files.map((f) => relative(ROOT, f))).toEqual(
      expect.arrayContaining(['app/(tabs)/log.tsx', 'app/onboarding/join.tsx']),
    );
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))('%s takes it from the theme', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/placeholderTextColor=\{?\s*["'`]/);
  });
});
