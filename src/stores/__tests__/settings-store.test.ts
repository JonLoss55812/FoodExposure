import { useSettingsStore } from '../settings-store';

beforeEach(() => {
  useSettingsStore.setState({
    theme: 'system',
    quickLogMode: false,
    notificationsEnabled: true,
  });
});

describe('useSettingsStore', () => {
  describe('initial state', () => {
    it('has sensible defaults', () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
      expect(state.quickLogMode).toBe(false);
      expect(state.notificationsEnabled).toBe(true);
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
});
