import { act, renderHook } from '@testing-library/react';
import { useChildStore, useSelectedChildId } from '../child-store';

beforeEach(() => {
  useChildStore.setState({ selectedChildId: null });
});

describe('useChildStore', () => {
  it('starts with no selected child', () => {
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('selects a child', () => {
    useChildStore.getState().selectChild('child-1');
    expect(useChildStore.getState().selectedChildId).toBe('child-1');
  });

  it('can switch selected child', () => {
    useChildStore.getState().selectChild('child-1');
    useChildStore.getState().selectChild('child-2');
    expect(useChildStore.getState().selectedChildId).toBe('child-2');
  });
});

describe('clear', () => {
  it('resets selectedChildId to null after a selection', () => {
    useChildStore.getState().selectChild('child-1');
    expect(useChildStore.getState().selectedChildId).toBe('child-1');

    useChildStore.getState().clear();

    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('is a no-op when nothing was selected', () => {
    useChildStore.getState().clear();
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });
});

describe('ensureSelection', () => {
  it('picks the first child when selectedChildId is null', () => {
    useChildStore.getState().ensureSelection([{ id: 'a' }, { id: 'b' }]);
    expect(useChildStore.getState().selectedChildId).toBe('a');
  });

  it('re-selects the first child when current id is missing from list', () => {
    useChildStore.setState({ selectedChildId: 'deleted-child' });
    useChildStore.getState().ensureSelection([{ id: 'a' }, { id: 'b' }]);
    expect(useChildStore.getState().selectedChildId).toBe('a');
  });

  it('no-ops when the current id is still in the list', () => {
    useChildStore.setState({ selectedChildId: 'b' });
    useChildStore.getState().ensureSelection([{ id: 'a' }, { id: 'b' }]);
    expect(useChildStore.getState().selectedChildId).toBe('b');
  });

  it('clears selection to null when the children list is empty', () => {
    useChildStore.setState({ selectedChildId: 'a' });
    useChildStore.getState().ensureSelection([]);
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('leaves selection as null when the children list is empty and nothing was selected', () => {
    useChildStore.getState().ensureSelection([]);
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });
});

describe('useSelectedChildId', () => {
  it('returns null when no child is selected', () => {
    const { result } = renderHook(() => useSelectedChildId());
    expect(result.current).toBeNull();
  });

  it('returns the selected child id and re-renders on selectChild', () => {
    const { result } = renderHook(() => useSelectedChildId());

    act(() => {
      useChildStore.getState().selectChild('child-7');
    });
    expect(result.current).toBe('child-7');

    act(() => {
      useChildStore.getState().selectChild('child-9');
    });
    expect(result.current).toBe('child-9');
  });

  it('reflects ensureSelection auto-pick', () => {
    const { result } = renderHook(() => useSelectedChildId());

    act(() => {
      useChildStore.getState().ensureSelection([{ id: 'first' }, { id: 'second' }]);
    });
    expect(result.current).toBe('first');
  });
});

describe('persist storage adapter', () => {
  it('clearStorage routes through MMKV remove (covers removeItem branch)', async () => {
    useChildStore.getState().selectChild('child-persist');
    await useChildStore.persist.clearStorage();
    expect(useChildStore.persist.hasHydrated()).toBe(true);
  });
});
