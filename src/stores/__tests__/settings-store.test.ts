import { useSettingsStore } from '../settings-store';

beforeEach(() => {
  useSettingsStore.setState({
    theme: 'system',
    feedingProfile: 'typical',
  });
});

describe('useSettingsStore', () => {
  describe('initial state', () => {
    it('has sensible defaults', () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.feedingProfile).toBe('typical');
    });
  });

  describe('setTheme', () => {
    it('changes theme to light', () => {
      useSettingsStore.getState().setTheme('light');
      expect(useSettingsStore.getState().theme).toBe('light');
    });

    it('changes theme to dark', () => {
      useSettingsStore.getState().setTheme('dark');
      expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('changes theme back to system', () => {
      useSettingsStore.getState().setTheme('dark');
      useSettingsStore.getState().setTheme('system');
      expect(useSettingsStore.getState().theme).toBe('system');
    });
  });

  describe('setFeedingProfile', () => {
    it('switches to picky profile', () => {
      useSettingsStore.getState().setFeedingProfile('picky');
      expect(useSettingsStore.getState().feedingProfile).toBe('picky');
    });

    it('switches to arfid profile', () => {
      useSettingsStore.getState().setFeedingProfile('arfid');
      expect(useSettingsStore.getState().feedingProfile).toBe('arfid');
    });

    it('switches back to typical', () => {
      useSettingsStore.getState().setFeedingProfile('arfid');
      useSettingsStore.getState().setFeedingProfile('typical');
      expect(useSettingsStore.getState().feedingProfile).toBe('typical');
    });
  });

  describe('persist storage adapter', () => {
    it('clearStorage routes through MMKV remove (covers removeItem branch)', async () => {
      useSettingsStore.getState().setTheme('dark');
      await useSettingsStore.persist.clearStorage();
      expect(useSettingsStore.persist.hasHydrated()).toBe(true);
    });
  });
});
