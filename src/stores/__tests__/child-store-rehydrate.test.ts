/**
 * Verifies the child-store's `merge` callback validates the persisted
 * `selectedChildId` is `string | null` and falls back to the in-memory
 * default (`null`) when corrupted JSON survives rehydration. Without this
 * guard, a future schema-rename or hand-edited persisted blob could load
 * `selectedChildId: 42` (number) or `selectedChildId: { evil: 'object' }`
 * into state. Downstream `ensureSelection` does `c.id === current` (string
 * vs non-string) — always false, so a real child id never matches a corrupt
 * persisted value, but worse: a non-null non-string value evaluates as
 * truthy in `current !== null` so the early return on the children=[] path
 * would skip auto-selection. Mirrors v0.5.90 settings-store rehydrate test.
 */

describe('child-store rehydration validation', () => {
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

  it('preserves a valid persisted string selectedChildId', () => {
    mockMMKVWithBlob(persistedBlob({ selectedChildId: 'child-123' }));
    const { useChildStore } = require('../child-store');
    expect(useChildStore.getState().selectedChildId).toBe('child-123');
  });

  it('preserves persisted null selectedChildId', () => {
    mockMMKVWithBlob(persistedBlob({ selectedChildId: null }));
    const { useChildStore } = require('../child-store');
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('falls back to default null when persisted value is a number', () => {
    mockMMKVWithBlob(persistedBlob({ selectedChildId: 42 }));
    const { useChildStore } = require('../child-store');
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('falls back to default null when persisted value is an object', () => {
    mockMMKVWithBlob(persistedBlob({ selectedChildId: { evil: 'object' } }));
    const { useChildStore } = require('../child-store');
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('falls back to default null when persisted value is an array', () => {
    mockMMKVWithBlob(persistedBlob({ selectedChildId: ['a', 'b'] }));
    const { useChildStore } = require('../child-store');
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('falls back to default null when persisted value is undefined (key missing)', () => {
    mockMMKVWithBlob(persistedBlob({}));
    const { useChildStore } = require('../child-store');
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });
});
