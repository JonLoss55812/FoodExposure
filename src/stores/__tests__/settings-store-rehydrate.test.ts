/**
 * Verifies the settings-store's `merge` callback validates persisted enum
 * values against the canonical THEME_MODES / FEEDING_PROFILES sets and falls
 * back to defaults when corrupted JSON survives rehydration. Without this
 * guard, a future schema-rename or hand-edited persisted blob could load
 * `theme: 'evil'` or `feedingProfile: 'unknown'` into state — both flow into
 * downstream lookups (`FEEDING_PROFILE_CONFIG[profile].label`,
 * `EXPOSURE_THRESHOLDS[profile]`) that would crash or produce NaN.
 */

describe('settings-store rehydration validation', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function mockMMKVWithBlob(blob: string | null) {
    jest.doMock('react-native-mmkv', () => ({
      createMMKV: () => ({
        getString: () => blob,
        set: () => {},
        remove: () => {},
      }),
    }));
  }

  function persistedBlob(state: Record<string, unknown>): string {
    return JSON.stringify({ state, version: 0 });
  }

  it('preserves valid persisted theme and feedingProfile', () => {
    mockMMKVWithBlob(persistedBlob({ theme: 'dark', feedingProfile: 'arfid' }));
    const { useSettingsStore } = require('../settings-store');
    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().feedingProfile).toBe('arfid');
  });

  it('falls back to default theme when persisted value is not in THEME_MODES', () => {
    mockMMKVWithBlob(persistedBlob({ theme: 'evil', feedingProfile: 'picky' }));
    const { useSettingsStore } = require('../settings-store');
    expect(useSettingsStore.getState().theme).toBe('system');
    expect(useSettingsStore.getState().feedingProfile).toBe('picky');
  });

  it('falls back to default feedingProfile when persisted value is not in FEEDING_PROFILES', () => {
    mockMMKVWithBlob(persistedBlob({ theme: 'light', feedingProfile: 'unknown' }));
    const { useSettingsStore } = require('../settings-store');
    expect(useSettingsStore.getState().theme).toBe('light');
    expect(useSettingsStore.getState().feedingProfile).toBe('typical');
  });

  it('falls back to both defaults when both persisted values are invalid', () => {
    mockMMKVWithBlob(persistedBlob({ theme: 42, feedingProfile: null }));
    const { useSettingsStore } = require('../settings-store');
    expect(useSettingsStore.getState().theme).toBe('system');
    expect(useSettingsStore.getState().feedingProfile).toBe('typical');
  });

  it('falls back to defaults when persisted state is missing keys entirely', () => {
    mockMMKVWithBlob(persistedBlob({}));
    const { useSettingsStore } = require('../settings-store');
    expect(useSettingsStore.getState().theme).toBe('system');
    expect(useSettingsStore.getState().feedingProfile).toBe('typical');
  });

  it('preserves all three valid theme modes individually', () => {
    for (const theme of ['light', 'dark', 'system']) {
      jest.resetModules();
      mockMMKVWithBlob(persistedBlob({ theme, feedingProfile: 'typical' }));
      const { useSettingsStore } = require('../settings-store');
      expect(useSettingsStore.getState().theme).toBe(theme);
    }
  });

  it('preserves all three valid feeding profiles individually', () => {
    for (const profile of ['typical', 'picky', 'arfid']) {
      jest.resetModules();
      mockMMKVWithBlob(persistedBlob({ theme: 'system', feedingProfile: profile }));
      const { useSettingsStore } = require('../settings-store');
      expect(useSettingsStore.getState().feedingProfile).toBe(profile);
    }
  });
});
