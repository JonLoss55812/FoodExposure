import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'auth-storage' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.remove(name),
};

interface AuthState {
  userId: string | null;
  familyId: string | null;
  email: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  login: (data: { userId: string; familyId: string; email: string; displayName: string }) => void;
  logout: () => void;
  setOnboarded: (value: boolean) => void;
  setFamilyId: (familyId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      familyId: null,
      email: null,
      displayName: null,
      isAuthenticated: false,
      isOnboarded: false,
      login: (data) => set({ ...data, isAuthenticated: true }),
      logout: () => set({ userId: null, familyId: null, email: null, displayName: null, isAuthenticated: false }),
      setOnboarded: (value) => set({ isOnboarded: value }),
      setFamilyId: (familyId) => set({ familyId }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
