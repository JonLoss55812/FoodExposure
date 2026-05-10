/**
 * Verifies the auth-store's `merge` callback validates persisted field types
 * and enforces cross-field consistency between `isAuthenticated` and the
 * (userId, familyId, email, displayName) tuple. Without this guard, a
 * corrupted MMKV blob (future schema rename, hand-edit, partial write across
 * an upgrade) carrying e.g. `isAuthenticated: true` with `userId: null` would
 * pass downstream gates that assume the auth tuple is complete.
 *
 * Mirrors the v0.5.90 settings-store-rehydrate.test.ts and v0.5.108
 * child-store-rehydrate.test.ts pattern verbatim.
 */

describe('auth-store rehydration validation', () => {
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

  it('preserves a fully valid persisted authenticated state', () => {
    mockMMKVWithBlob(
      persistedBlob({
        userId: 'u1',
        familyId: 'f1',
        email: 'a@b.co',
        displayName: 'Alice',
        isAuthenticated: true,
        isOnboarded: true,
      }),
    );
    const { useAuthStore } = require('../auth-store');
    const s = useAuthStore.getState();
    expect(s.userId).toBe('u1');
    expect(s.familyId).toBe('f1');
    expect(s.email).toBe('a@b.co');
    expect(s.displayName).toBe('Alice');
    expect(s.isAuthenticated).toBe(true);
    expect(s.isOnboarded).toBe(true);
  });

  it('preserves a valid signed-out state (all nulls + flags false)', () => {
    mockMMKVWithBlob(
      persistedBlob({
        userId: null,
        familyId: null,
        email: null,
        displayName: null,
        isAuthenticated: false,
        isOnboarded: false,
      }),
    );
    const { useAuthStore } = require('../auth-store');
    const s = useAuthStore.getState();
    expect(s.userId).toBeNull();
    expect(s.familyId).toBeNull();
    expect(s.email).toBeNull();
    expect(s.displayName).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isOnboarded).toBe(false);
  });

  it('forces isAuthenticated=false when userId is null but persisted flag was true', () => {
    mockMMKVWithBlob(
      persistedBlob({
        userId: null,
        familyId: 'f1',
        email: 'a@b.co',
        displayName: 'Alice',
        isAuthenticated: true,
        isOnboarded: true,
      }),
    );
    const { useAuthStore } = require('../auth-store');
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.userId).toBeNull();
    // Other fields preserved (don't poison data, just defang the flag)
    expect(s.familyId).toBe('f1');
    expect(s.email).toBe('a@b.co');
    expect(s.displayName).toBe('Alice');
    expect(s.isOnboarded).toBe(true);
  });

  it('forces isAuthenticated=false when any one of the auth tuple fields is null', () => {
    for (const missing of ['userId', 'familyId', 'email', 'displayName']) {
      jest.resetModules();
      const state: Record<string, unknown> = {
        userId: 'u1',
        familyId: 'f1',
        email: 'a@b.co',
        displayName: 'Alice',
        isAuthenticated: true,
        isOnboarded: false,
      };
      state[missing] = null;
      mockMMKVWithBlob(persistedBlob(state));
      const { useAuthStore } = require('../auth-store');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    }
  });

  it('falls back to default for non-string-or-null userId', () => {
    mockMMKVWithBlob(
      persistedBlob({
        userId: 42,
        familyId: 'f1',
        email: 'a@b.co',
        displayName: 'Alice',
        isAuthenticated: true,
        isOnboarded: false,
      }),
    );
    const { useAuthStore } = require('../auth-store');
    const s = useAuthStore.getState();
    expect(s.userId).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it('falls back to default for non-boolean isOnboarded', () => {
    mockMMKVWithBlob(
      persistedBlob({
        userId: null,
        familyId: null,
        email: null,
        displayName: null,
        isAuthenticated: false,
        isOnboarded: 'yes',
      }),
    );
    const { useAuthStore } = require('../auth-store');
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('falls back to default for non-boolean isAuthenticated', () => {
    mockMMKVWithBlob(
      persistedBlob({
        userId: 'u1',
        familyId: 'f1',
        email: 'a@b.co',
        displayName: 'Alice',
        isAuthenticated: 'true',
        isOnboarded: false,
      }),
    );
    const { useAuthStore } = require('../auth-store');
    // String 'true' fails isValidBoolean → falls back to current.isAuthenticated (false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('falls back for non-string-or-null on each of the 4 string-or-null fields', () => {
    for (const field of ['userId', 'familyId', 'email', 'displayName']) {
      for (const bad of [42, { evil: 'object' }, ['a'], true]) {
        jest.resetModules();
        const state: Record<string, unknown> = {
          userId: 'u1',
          familyId: 'f1',
          email: 'a@b.co',
          displayName: 'Alice',
          isAuthenticated: false,
          isOnboarded: false,
        };
        state[field] = bad;
        mockMMKVWithBlob(persistedBlob(state));
        const { useAuthStore } = require('../auth-store');
        expect(useAuthStore.getState()[field]).toBeNull();
      }
    }
  });

  it('falls back to defaults when persisted state is missing keys entirely', () => {
    mockMMKVWithBlob(persistedBlob({}));
    const { useAuthStore } = require('../auth-store');
    const s = useAuthStore.getState();
    expect(s.userId).toBeNull();
    expect(s.familyId).toBeNull();
    expect(s.email).toBeNull();
    expect(s.displayName).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isOnboarded).toBe(false);
  });
});
