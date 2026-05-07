import { act, renderHook } from '@testing-library/react';
import {
  useAuthStore,
  useAuthFamilyId,
  useAuthUserId,
  useIsAuthenticated,
  useIsOnboarded,
} from '../auth-store';

// Reset store between tests
beforeEach(() => {
  useAuthStore.setState({
    userId: null,
    familyId: null,
    email: null,
    displayName: null,
    isAuthenticated: false,
    isOnboarded: false,
  });
});

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('starts unauthenticated', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.familyId).toBeNull();
      expect(state.email).toBeNull();
      expect(state.displayName).toBeNull();
      expect(state.isOnboarded).toBe(false);
    });
  });

  describe('login', () => {
    it('sets user data and marks as authenticated', () => {
      useAuthStore.getState().login({
        userId: 'user-1',
        familyId: 'family-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userId).toBe('user-1');
      expect(state.familyId).toBe('family-1');
      expect(state.email).toBe('test@example.com');
      expect(state.displayName).toBe('Test User');
    });
  });

  describe('logout', () => {
    it('clears all user data', () => {
      useAuthStore.getState().login({
        userId: 'user-1',
        familyId: 'family-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.familyId).toBeNull();
      expect(state.email).toBeNull();
      expect(state.displayName).toBeNull();
    });

    it('resets isOnboarded so the onboarding flow re-runs after sign-out', () => {
      useAuthStore.getState().login({
        userId: 'user-1',
        familyId: 'family-1',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      useAuthStore.getState().setOnboarded(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);

      useAuthStore.getState().logout();

      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });
  });

  describe('setOnboarded', () => {
    it('sets onboarded state', () => {
      useAuthStore.getState().setOnboarded(true);
      expect(useAuthStore.getState().isOnboarded).toBe(true);

      useAuthStore.getState().setOnboarded(false);
      expect(useAuthStore.getState().isOnboarded).toBe(false);
    });
  });

  describe('setFamilyId', () => {
    it('updates family ID', () => {
      useAuthStore.getState().setFamilyId('new-family');
      expect(useAuthStore.getState().familyId).toBe('new-family');
    });
  });

  describe('typed selector hooks', () => {
    it('useAuthUserId returns null initially and current userId after login', () => {
      const { result } = renderHook(() => useAuthUserId());
      expect(result.current).toBeNull();

      act(() => {
        useAuthStore.getState().login({
          userId: 'user-42',
          familyId: 'family-1',
          email: 'a@b.co',
          displayName: 'A',
        });
      });
      expect(result.current).toBe('user-42');
    });

    it('useAuthFamilyId tracks setFamilyId updates', () => {
      const { result } = renderHook(() => useAuthFamilyId());
      expect(result.current).toBeNull();

      act(() => {
        useAuthStore.getState().setFamilyId('family-99');
      });
      expect(result.current).toBe('family-99');
    });

    it('useIsAuthenticated flips true on login and false on logout', () => {
      const { result } = renderHook(() => useIsAuthenticated());
      expect(result.current).toBe(false);

      act(() => {
        useAuthStore.getState().login({
          userId: 'u',
          familyId: 'f',
          email: 'e',
          displayName: 'd',
        });
      });
      expect(result.current).toBe(true);

      act(() => {
        useAuthStore.getState().logout();
      });
      expect(result.current).toBe(false);
    });

    it('useIsOnboarded mirrors setOnboarded', () => {
      const { result } = renderHook(() => useIsOnboarded());
      expect(result.current).toBe(false);

      act(() => {
        useAuthStore.getState().setOnboarded(true);
      });
      expect(result.current).toBe(true);
    });
  });

  describe('persist storage adapter', () => {
    it('clearStorage routes through MMKV remove (covers removeItem branch)', async () => {
      useAuthStore.getState().login({
        userId: 'persist-user',
        familyId: 'persist-family',
        email: 'p@e.co',
        displayName: 'P',
      });
      await useAuthStore.persist.clearStorage();
      expect(useAuthStore.persist.hasHydrated()).toBe(true);
    });
  });
});
