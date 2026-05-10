import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'auth-storage' });

const mmkvStorage = {
  getItem: (name: string) => {
    try {
      return storage.getString(name) ?? null;
    } catch (err) {
      console.error('auth-store MMKV getItem failed:', err);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      storage.set(name, value);
    } catch (err) {
      console.error('auth-store MMKV setItem failed:', err);
    }
  },
  removeItem: (name: string) => {
    try {
      storage.remove(name);
    } catch (err) {
      console.error('auth-store MMKV removeItem failed:', err);
    }
  },
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

const isValidStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isValidBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

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
      logout: () => set({ userId: null, familyId: null, email: null, displayName: null, isAuthenticated: false, isOnboarded: false }),
      setOnboarded: (value) => set({ isOnboarded: value }),
      setFamilyId: (familyId) => set({ familyId }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => mmkvStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>;
        const userId = isValidStringOrNull(p.userId) ? p.userId : current.userId;
        const familyId = isValidStringOrNull(p.familyId) ? p.familyId : current.familyId;
        const email = isValidStringOrNull(p.email) ? p.email : current.email;
        const displayName = isValidStringOrNull(p.displayName) ? p.displayName : current.displayName;
        const persistedAuth = isValidBoolean(p.isAuthenticated) ? p.isAuthenticated : current.isAuthenticated;
        const isOnboarded = isValidBoolean(p.isOnboarded) ? p.isOnboarded : current.isOnboarded;
        // Cross-field consistency: isAuthenticated is only true when the full
        // auth tuple is non-null. A corrupt blob with isAuthenticated=true but
        // any of (userId, familyId, email, displayName) null would otherwise
        // pass downstream gates that assume the tuple is complete.
        const tupleComplete =
          userId !== null && familyId !== null && email !== null && displayName !== null;
        const isAuthenticated = persistedAuth && tupleComplete;
        return {
          ...current,
          userId,
          familyId,
          email,
          displayName,
          isAuthenticated,
          isOnboarded,
        };
      },
    }
  )
);

// Typed selectors for performance — prevents unnecessary re-renders
export const useAuthFamilyId = () => useAuthStore((s) => s.familyId);
export const useAuthUserId = () => useAuthStore((s) => s.userId);
export const useIsAuthenticated = () => useAuthStore((s) => s.isAuthenticated);
export const useIsOnboarded = () => useAuthStore((s) => s.isOnboarded);
