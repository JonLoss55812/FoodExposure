import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import { FEEDING_PROFILES, type FeedingProfile } from '@/src/lib/thresholds';

const storage = createMMKV({ id: 'settings-storage' });

const mmkvStorage = {
  getItem: (name: string) => {
    try {
      return storage.getString(name) ?? null;
    } catch (err) {
      console.error('settings-store MMKV getItem failed:', err);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      storage.set(name, value);
    } catch (err) {
      console.error('settings-store MMKV setItem failed:', err);
    }
  },
  removeItem: (name: string) => {
    try {
      storage.remove(name);
    } catch (err) {
      console.error('settings-store MMKV removeItem failed:', err);
    }
  },
};

const THEME_MODES = ['light', 'dark', 'system'] as const;
type ThemeMode = typeof THEME_MODES[number];

interface SettingsState {
  theme: ThemeMode;
  feedingProfile: FeedingProfile;
  setTheme: (theme: ThemeMode) => void;
  setFeedingProfile: (value: FeedingProfile) => void;
}

const isValidTheme = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);

const isValidFeedingProfile = (value: unknown): value is FeedingProfile =>
  typeof value === 'string' && (FEEDING_PROFILES as readonly string[]).includes(value);

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      feedingProfile: 'typical',
      setTheme: (theme) => set({ theme }),
      setFeedingProfile: (value) => set({ feedingProfile: value }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => mmkvStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          theme: isValidTheme(p.theme) ? p.theme : current.theme,
          feedingProfile: isValidFeedingProfile(p.feedingProfile)
            ? p.feedingProfile
            : current.feedingProfile,
        };
      },
    }
  )
);
