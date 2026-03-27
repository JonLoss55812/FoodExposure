import { useChildStore } from '../child-store';

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
