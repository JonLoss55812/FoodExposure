/**
 * @jest-environment node
 *
 * On web, Metro resolves zustand's ESM build, and its middleware reads
 * `import.meta.env`. The web bundle is a classic script, so an untransformed
 * `import.meta` is a SyntaxError and the page renders nothing ("Cannot use
 * 'import.meta' outside a module", seen in a headless browser at v0.5.266).
 * Native resolved zustand's CommonJS build, so only web was affected.
 */
import { transformSync } from '@babel/core';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

function transformForWeb(code: string): string {
  const out = transformSync(code, {
    filename: join(ROOT, 'node_modules/zustand/esm/middleware.mjs'),
    configFile: join(ROOT, 'babel.config.js'),
    babelrc: false,
    sourceType: 'module',
    caller: { name: 'metro', bundler: 'metro', platform: 'web' } as never,
  });
  return out?.code ?? '';
}

describe('babel.config.js (import.meta on web)', () => {
  it('rewrites import.meta so the web bundle can parse it', () => {
    const code = transformForWeb('export const mode = import.meta.env ? import.meta.env.MODE : undefined;');
    expect(code).not.toMatch(/import\.meta/);
    expect(code).toMatch(/__ExpoImportMetaRegistry/);
  });
});
