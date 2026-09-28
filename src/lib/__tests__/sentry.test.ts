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
      expect(config.attachScreenshot).toBe(false);
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

describe('query-param redaction', () => {
  // Built the way drizzle-orm's DrizzleQueryError builds its message.
  const QUERY = 'insert into "exposures" ("id", "notes") values (?, ?)';
  const drizzleError = (params: unknown[]) => {
    const err = new Error(`Failed query: ${QUERY}\nparams: ${params}`);
    err.stack = `Error: ${err.message}\n    at insert (client.js:1:1)\n    at onSubmit (log.tsx:2:2)`;
    return err;
  };

  let mod: typeof import('../sentry');
  beforeAll(async () => {
    await jest.isolateModulesAsync(async () => {
      mod = require('../sentry');
    });
  });

  it('redactQueryParams keeps the query and drops the bound values', () => {
    const out = mod.redactQueryParams(`Failed query: ${QUERY}\nparams: abc-123,Emma spat it out`);
    expect(out).toContain(QUERY);
    expect(out).not.toContain('Emma');
    expect(out).toContain('params: [redacted]');
  });

  it('redactQueryParams drops every line of a multi-line note but keeps the stack', () => {
    const out = mod.redactQueryParams(drizzleError(['id-1', 'line one\nline two\nline three']).stack!);
    expect(out).not.toMatch(/line (one|two|three)/);
    expect(out).toContain('at insert (client.js:1:1)');
    expect(out).toContain('at onSubmit (log.tsx:2:2)');
  });

  it('redactQueryParams leaves text without a params section untouched', () => {
    expect(mod.redactQueryParams('Failed to load dashboard data:')).toBe('Failed to load dashboard data:');
    expect(mod.redactQueryParams(undefined)).toBeUndefined();
  });

  it('scrubBreadcrumb redacts the console message and the raw Error argument', () => {
    const err = drizzleError(['child-1', 'refused the broccoli']);
    const crumb = mod.scrubBreadcrumb({
      category: 'console',
      message: `Failed to save exposure: ${err.stack}`,
      data: { logger: 'console', arguments: ['Failed to save exposure:', err] },
    });
    expect(JSON.stringify(crumb)).not.toContain('broccoli');
    expect(crumb.message).toContain(QUERY);
    expect(crumb.data?.arguments[0]).toBe('Failed to save exposure:');
    expect(String(crumb.data?.arguments[1])).toContain('params: [redacted]');
  });

  it('scrubEvent redacts exception values', () => {
    const event = mod.scrubEvent({
      exception: { values: [{ type: 'Error', value: `Failed query: ${QUERY}\nparams: 1,Oliver` }] },
    } as any);
    expect(event.exception!.values![0].value).not.toContain('Oliver');
    expect(event.exception!.values![0].value).toContain(QUERY);
  });

  it('initSentry wires both hooks into Sentry.init', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o123.ingest.sentry.io/456';
    await jest.isolateModulesAsync(async () => {
      const m = require('../sentry');
      m.initSentry();
      const config = mockInit.mock.calls[0][0];
      const crumb = config.beforeBreadcrumb({ category: 'console', message: 'params: secret' });
      expect(crumb.message).toBe('params: [redacted]');
      const event = config.beforeSend({ exception: { values: [{ value: 'params: secret' }] } });
      expect(event.exception.values[0].value).toBe('params: [redacted]');
    });
  });
});
});
