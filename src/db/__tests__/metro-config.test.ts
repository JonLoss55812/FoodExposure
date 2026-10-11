/**
 * @jest-environment node
 *
 * expo-sqlite's web worker imports `wa-sqlite.wasm`. Metro only bundles that
 * import when `wasm` is an asset extension, so without it `expo export
 * --platform web` fails outright. The worker also needs SharedArrayBuffer,
 * which browsers only expose to a cross-origin-isolated page, so the dev
 * server must send COOP/COEP headers or the database never opens on web.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../../metro.config.js');

describe('metro.config.js (expo-sqlite on web)', () => {
  it('treats .wasm as an asset so the sqlite worker bundles', () => {
    expect(config.resolver.assetExts).toContain('wasm');
  });

  it('keeps the default asset extensions', () => {
    expect(config.resolver.assetExts).toEqual(expect.arrayContaining(['png', 'ttf']));
  });

  it('serves the cross-origin isolation headers SharedArrayBuffer needs', () => {
    const inner = jest.fn();
    const middleware = config.server.enhanceMiddleware(inner, {});
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => { headers[k] = v; } };
    const req = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Embedder-Policy']).toBe('credentialless');
    expect(inner).toHaveBeenCalledWith(req, res, next);
  });
});
