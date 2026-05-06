/**
 * Verifies that all three zustand stores survive an MMKV that throws on
 * every operation — the documented "MMKV storage corrupted across upgrade"
 * failure mode in NEXT_STEPS.md. The wrapped getItem/setItem/removeItem
 * adapters must catch the error so the persist middleware can fall back to
 * defaults instead of propagating the throw to React's tree.
 */

describe('MMKV adapter resilience', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function mockThrowingMMKV() {
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: () => ({
        getString: () => {
          throw new Error('mmkv corrupted');
        },
        set: () => {
          throw new Error('mmkv corrupted');
        },
        remove: () => {
          throw new Error('mmkv corrupted');
        },
      }),
    }));
  }

  it('child-store loads with defaults when MMKV getString throws', () => {
    mockThrowingMMKV();
    expect(() => {
      const { useChildStore } = require('../child-store');
      expect(useChildStore.getState().selectedChildId).toBeNull();
    }).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'child-store MMKV getItem failed:',
      expect.any(Error)
    );
  });

  it('child-store selectChild does not crash when MMKV.set throws', () => {
    mockThrowingMMKV();
    const { useChildStore } = require('../child-store');
    expect(() => {
      useChildStore.getState().selectChild('child-1');
    }).not.toThrow();
    expect(useChildStore.getState().selectedChildId).toBe('child-1');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'child-store MMKV setItem failed:',
      expect.any(Error)
    );
  });

  it('auth-store loads with defaults when MMKV getString throws', () => {
    mockThrowingMMKV();
    expect(() => {
      const { useAuthStore } = require('../auth-store');
      expect(useAuthStore.getState().userId).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    }).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'auth-store MMKV getItem failed:',
      expect.any(Error)
    );
  });

  it('auth-store login does not crash when MMKV.set throws', () => {
    mockThrowingMMKV();
    const { useAuthStore } = require('../auth-store');
    expect(() => {
      useAuthStore.getState().login({
        userId: 'u1',
        familyId: 'f1',
        email: 'a@b.com',
        displayName: 'A',
      });
    }).not.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('settings-store loads with defaults when MMKV getString throws', () => {
    mockThrowingMMKV();
    expect(() => {
      const { useSettingsStore } = require('../settings-store');
      expect(useSettingsStore.getState().theme).toBe('system');
      expect(useSettingsStore.getState().feedingProfile).toBe('typical');
    }).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'settings-store MMKV getItem failed:',
      expect.any(Error)
    );
  });

  it('settings-store setTheme does not crash when MMKV.set throws', () => {
    mockThrowingMMKV();
    const { useSettingsStore } = require('../settings-store');
    expect(() => {
      useSettingsStore.getState().setTheme('dark');
    }).not.toThrow();
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('child-store clearStorage does not crash when MMKV.remove throws', () => {
    mockThrowingMMKV();
    const { useChildStore } = require('../child-store');
    expect(() => {
      useChildStore.persist.clearStorage();
    }).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'child-store MMKV removeItem failed:',
      expect.any(Error)
    );
  });

  it('auth-store clearStorage does not crash when MMKV.remove throws', () => {
    mockThrowingMMKV();
    const { useAuthStore } = require('../auth-store');
    expect(() => {
      useAuthStore.persist.clearStorage();
    }).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'auth-store MMKV removeItem failed:',
      expect.any(Error)
    );
  });

  it('settings-store clearStorage does not crash when MMKV.remove throws', () => {
    mockThrowingMMKV();
    const { useSettingsStore } = require('../settings-store');
    expect(() => {
      useSettingsStore.persist.clearStorage();
    }).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'settings-store MMKV removeItem failed:',
      expect.any(Error)
    );
  });
});
