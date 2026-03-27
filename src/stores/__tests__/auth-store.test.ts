import { useAuthStore } from '../auth-store';

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
});
