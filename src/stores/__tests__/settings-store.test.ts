import { useSettingsStore } from '../settings-store';

beforeEach(() => {
  useSettingsStore.setState({
    theme: 'system',
    quickLogMode: false,
    notificationsEnabled: true,
    feedingProfile: 'typical',
  });
});

describe('useSettingsStore', () => {
  describe('initial state', () => {
    it('has sensible defaults', () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.quickLogMode).toBe(false);
      expect(state.notificationsEnabled).toBe(true);
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

  describe('setQuickLogMode', () => {
    it('toggles quick log mode', () => {
      useSettingsStore.getState().setQuickLogMode(true);
      expect(useSettingsStore.getState().quickLogMode).toBe(true);

      useSettingsStore.getState().setQuickLogMode(false);
      expect(useSettingsStore.getState().quickLogMode).toBe(false);
    });
  });

  describe('setNotificationsEnabled', () => {
    it('toggles notifications', () => {
      useSettingsStore.getState().setNotificationsEnabled(false);
      expect(useSettingsStore.getState().notificationsEnabled).toBe(false);

      useSettingsStore.getState().setNotificationsEnabled(true);
      expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
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
});
