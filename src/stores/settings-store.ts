import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { FeedingProfile } from '@/src/lib/thresholds';

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

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemeMode;
  quickLogMode: boolean;
  notificationsEnabled: boolean;
  feedingProfile: FeedingProfile;
  setTheme: (theme: ThemeMode) => void;
  setQuickLogMode: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setFeedingProfile: (value: FeedingProfile) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      quickLogMode: false,
      notificationsEnabled: true,
      feedingProfile: 'typical',
      setTheme: (theme) => set({ theme }),
      setQuickLogMode: (value) => set({ quickLogMode: value }),
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setFeedingProfile: (value) => set({ feedingProfile: value }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
