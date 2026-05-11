/**
 * Unit tests for the PostHog wrapper. The module-scoped `posthog` singleton
 * is reset between tests via `jest.isolateModules`, so each `it` block re-imports
 * a clean module under a freshly-stubbed `process.env`.
 */

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockConstructor = jest.fn();

jest.mock('posthog-react-native', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((apiKey: string, opts: Record<string, unknown>) => {
      mockConstructor(apiKey, opts);
      return {
        capture: mockCapture,
        identify: mockIdentify,
      };
    }),
  };
});

describe('lib/posthog', () => {
  const ORIGINAL_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const ORIGINAL_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;

  beforeEach(() => {
    mockCapture.mockClear();
    mockIdentify.mockClear();
    mockConstructor.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    else process.env.EXPO_PUBLIC_POSTHOG_API_KEY = ORIGINAL_KEY;
    if (ORIGINAL_HOST === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
    else process.env.EXPO_PUBLIC_POSTHOG_HOST = ORIGINAL_HOST;
  });

  it('initPostHog is a no-op when the API key env var is missing', async () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    await jest.isolateModulesAsync(async () => {
      const mod = require('../posthog');
      await mod.initPostHog();
      expect(mockConstructor).not.toHaveBeenCalled();
      // capture/identify are no-ops, do not throw
      expect(() => mod.captureEvent('test')).not.toThrow();
      expect(() => mod.identifyUser('u1')).not.toThrow();
      expect(mockCapture).not.toHaveBeenCalled();
      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  it('initPostHog constructs PostHog with the api key and default host when only key is set', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
    delete process.env.EXPO_PUBLIC_POSTHOG_HOST;
    await jest.isolateModulesAsync(async () => {
      const mod = require('../posthog');
      await mod.initPostHog();
      expect(mockConstructor).toHaveBeenCalledTimes(1);
      expect(mockConstructor).toHaveBeenCalledWith('phc_test_key', {
        host: 'https://us.i.posthog.com',
      });
    });
  });

  it('initPostHog uses EXPO_PUBLIC_POSTHOG_HOST when set', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
    process.env.EXPO_PUBLIC_POSTHOG_HOST = 'https://eu.posthog.example';
    await jest.isolateModulesAsync(async () => {
      const mod = require('../posthog');
      await mod.initPostHog();
      expect(mockConstructor).toHaveBeenCalledWith('phc_test_key', {
        host: 'https://eu.posthog.example',
      });
    });
  });

  it('captureEvent forwards event name and properties to the underlying client after init', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
    await jest.isolateModulesAsync(async () => {
      const mod = require('../posthog');
      await mod.initPostHog();
      mod.captureEvent('food_logged', { stage: 'taste' });
      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith('food_logged', { stage: 'taste' });
    });
  });

  it('identifyUser forwards id and properties to the underlying client after init', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
    await jest.isolateModulesAsync(async () => {
      const mod = require('../posthog');
      await mod.initPostHog();
      mod.identifyUser('user-42', { plan: 'free' });
      expect(mockIdentify).toHaveBeenCalledTimes(1);
      expect(mockIdentify).toHaveBeenCalledWith('user-42', { plan: 'free' });
    });
  });

  it('captureEvent and identifyUser are no-ops if called before init', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
    await jest.isolateModulesAsync(async () => {
      const mod = require('../posthog');
      // No init call.
      expect(() => mod.captureEvent('orphan_event')).not.toThrow();
      expect(() => mod.identifyUser('orphan_user')).not.toThrow();
      expect(mockCapture).not.toHaveBeenCalled();
      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe('empty/whitespace input guards', () => {
    it('captureEvent is a no-op when event is empty string', async () => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
      await jest.isolateModulesAsync(async () => {
        const mod = require('../posthog');
        await mod.initPostHog();
        mod.captureEvent('', { stage: 'taste' });
        expect(mockCapture).not.toHaveBeenCalled();
      });
    });

    it('captureEvent is a no-op when event is whitespace-only', async () => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
      await jest.isolateModulesAsync(async () => {
        const mod = require('../posthog');
        await mod.initPostHog();
        mod.captureEvent('   ', { stage: 'taste' });
        expect(mockCapture).not.toHaveBeenCalled();
      });
    });

    it('identifyUser is a no-op when userId is empty string', async () => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
      await jest.isolateModulesAsync(async () => {
        const mod = require('../posthog');
        await mod.initPostHog();
        mod.identifyUser('', { plan: 'free' });
        expect(mockIdentify).not.toHaveBeenCalled();
      });
    });

    it('identifyUser is a no-op when userId is whitespace-only', async () => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
      await jest.isolateModulesAsync(async () => {
        const mod = require('../posthog');
        await mod.initPostHog();
        mod.identifyUser('   ', { plan: 'free' });
        expect(mockIdentify).not.toHaveBeenCalled();
      });
    });

    it('captureEvent still fires when event is a single non-whitespace char', async () => {
      process.env.EXPO_PUBLIC_POSTHOG_API_KEY = 'phc_test_key';
      await jest.isolateModulesAsync(async () => {
        const mod = require('../posthog');
        await mod.initPostHog();
        mod.captureEvent('x');
        expect(mockCapture).toHaveBeenCalledTimes(1);
        expect(mockCapture).toHaveBeenCalledWith('x', undefined);
      });
    });
  });
});
