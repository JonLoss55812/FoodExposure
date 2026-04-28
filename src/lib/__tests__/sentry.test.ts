/**
 * Unit tests for the Sentry wrapper. SENTRY_DSN is read at module-top-level
 * in sentry.ts, so each test re-imports the module under a freshly-stubbed
 * process.env via jest.isolateModulesAsync.
 */

const mockInit = jest.fn();

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: mockInit,
}));

describe('lib/sentry', () => {
  const ORIGINAL_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    mockInit.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL_DSN === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    else process.env.EXPO_PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
  });

  it('initSentry is a no-op when EXPO_PUBLIC_SENTRY_DSN is missing', async () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    await jest.isolateModulesAsync(async () => {
      const mod = require('../sentry');
      mod.initSentry();
      expect(mockInit).not.toHaveBeenCalled();
    });
  });

  it('initSentry calls Sentry.init with the configured DSN and runtime flags', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o123.ingest.sentry.io/456';
    await jest.isolateModulesAsync(async () => {
      const mod = require('../sentry');
      mod.initSentry();
      expect(mockInit).toHaveBeenCalledTimes(1);
      const config = mockInit.mock.calls[0][0];
      expect(config.dsn).toBe('https://abc@o123.ingest.sentry.io/456');
      expect(config.tracesSampleRate).toBe(1.0);
      expect(config.enableAutoSessionTracking).toBe(true);
      expect(config.attachScreenshot).toBe(true);
      expect(['development', 'production']).toContain(config.environment);
    });
  });

  it('initSentry environment reflects __DEV__ at call time', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o123.ingest.sentry.io/456';
    const originalDev = (globalThis as any).__DEV__;
    try {
      (globalThis as any).__DEV__ = true;
      await jest.isolateModulesAsync(async () => {
        const mod = require('../sentry');
        mod.initSentry();
        expect(mockInit.mock.calls[0][0].environment).toBe('development');
      });

      mockInit.mockClear();
      (globalThis as any).__DEV__ = false;
      await jest.isolateModulesAsync(async () => {
        const mod = require('../sentry');
        mod.initSentry();
        expect(mockInit.mock.calls[0][0].environment).toBe('production');
      });
    } finally {
      (globalThis as any).__DEV__ = originalDev;
    }
  });

  it('re-exports the Sentry namespace', async () => {
    await jest.isolateModulesAsync(async () => {
      const mod = require('../sentry');
      expect(mod.Sentry).toBeDefined();
      expect(typeof mod.Sentry.init).toBe('function');
    });
  });
});
