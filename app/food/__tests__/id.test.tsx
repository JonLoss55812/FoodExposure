/**
 * Screen tests for `app/food/[id].tsx` — the second screen covered by the
 * v0.5.146 render harness, and the target NEXT_STEPS gap #1 named first.
 *
 * This screen holds the two most dangerous untested code paths in the app:
 * the v0.5.145 inline rename (which must not become a back door around the
 * v0.5.136 duplicate-name guard) and the v0.5.138 delete cascade (which
 * irreversibly discards every exposure logged against the food, for every
 * child). Both shipped screen-level and therefore unverified.
 *
 * Seams follow `app/onboarding/__tests__/join.test.tsx`: `expo-router`
 * mocked to a `mock`-prefixed spy object (jest's out-of-scope-variable
 * guard rejects a plain `router`), `@/src/db/client` mocked with a getter
 * so each test's fresh `createMockDb()` is picked up, `Alert.alert` spied
 * so alert copy is assertable, and the real zustand stores reset by hand.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
const mockParams = { id: 'food-1' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import FoodDetailScreen from '../[id]';
import { useChildStore } from '@/src/stores/child-store';

const FOOD = {
  id: 'food-1',
  familyId: 'fam-1',
  name: 'Apple',
  category: 'fruit',
  defaultPreparation: null,
  isSafeFood: false,
  createdAt: new Date(0),
};

/** Queue the screen's mount reads: the food row, then its exposures. */
function queueLoad(food: unknown = FOOD, exposures: unknown[] = []) {
  mockDb.queueSelect(food === null ? [] : [food]);
  mockDb.queueSelect(exposures);
}

/**
 * Mount and settle. The screen loads in a `useEffect`, so the render has to
 * be awaited inside `act` or React warns that the resulting state updates
 * escaped the test's control.
 */
async function renderSettled() {
  await act(async () => {
    render(<FoodDetailScreen />);
  });
}

async function renderLoaded() {
  await renderSettled();
  await waitFor(() => expect(screen.getByLabelText('Rename Apple')).toBeTruthy());
}

/**
 * Open the inline editor, type a draft, and save. `act` wraps the save so
 * the handler's async continuation (the sibling query, then either the
 * update or an alert) settles under the test's control.
 */
async function startRename(next: string) {
  fireEvent.click(screen.getByLabelText('Rename Apple'));
  fireEvent.change(screen.getByLabelText('Food name'), { target: { value: next } });
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Save food name'));
  });
}

async function click(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByLabelText(label));
  });
}

/** Invoke the destructive button inside a confirm Alert's button array. */
async function confirmAlert(alertSpy: jest.SpyInstance, text: string) {
  const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  const button = buttons.find((b) => b.text === text);
  expect(button).toBeTruthy();
  await act(async () => {
    await button!.onPress?.();
  });
}

describe('FoodDetailScreen', () => {
  let alertSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    useChildStore.getState().selectChild('child-1');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    errorSpy.mockRestore();
    useChildStore.getState().clear();
  });

  it('renders the loaded food with its rename affordance and delete action', async () => {
    queueLoad();
    await renderLoaded();
    expect(screen.getByLabelText('Delete Apple')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows the not-found empty state when the id matches no row', async () => {
    queueLoad(null);
    await renderSettled();
    await waitFor(() => expect(screen.getByText('Food Not Found')).toBeTruthy());
    expect(screen.queryByLabelText('Delete Apple')).toBeNull();
  });

  it('alerts instead of rendering a misleading empty state when the read fails', async () => {
    mockDb.failReads();
    await renderSettled();
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
  });

  describe('rename (v0.5.145)', () => {
    it('rejects a whitespace-only name through the shared foodSchema and writes nothing', async () => {
      queueLoad();
      await renderLoaded();
      await startRename('   ');

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toBe('Invalid Name');
      expect(mockDb.writes).toHaveLength(0);
      // The editor stays open so the parent can correct in place.
      expect(screen.getByLabelText('Food name')).toBeTruthy();
    });

    it('closes the editor without a query when the name is unchanged after trimming', async () => {
      queueLoad();
      await renderLoaded();
      const readsAfterLoad = mockDb.selectCount();
      await startRename('  Apple  ');

      await waitFor(() => expect(screen.getByLabelText('Rename Apple')).toBeTruthy());
      expect(mockDb.writes).toHaveLength(0);
      expect(mockDb.selectCount()).toBe(readsAfterLoad);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('blocks a rename that would collide with a different food (v0.5.136 guard)', async () => {
      queueLoad();
      await renderLoaded();
      // The sibling read the rename issues: a *different* row already named Pear.
      mockDb.queueSelect([
        { id: 'food-1', name: 'Apple' },
        { id: 'food-2', name: 'Pear' },
      ]);
      await startRename('pear');

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toBe('Already Added');
      expect(alertSpy.mock.calls[0][1]).toContain('Pear');
      expect(mockDb.writes).toHaveLength(0);
      expect(screen.getByLabelText('Food name')).toBeTruthy();
    });

    it('allows a case-only fix, which collides only with the food itself', async () => {
      queueLoad();
      await renderLoaded();
      mockDb.queueSelect([{ id: 'food-1', name: 'Apple' }]);
      await startRename('APPLE');

      await waitFor(() => expect(screen.getByLabelText('Rename APPLE')).toBeTruthy());
      expect(mockDb.writes).toEqual([{ kind: 'update', values: { name: 'APPLE' } }]);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('persists the trimmed name and closes the editor on the happy path', async () => {
      queueLoad();
      await renderLoaded();
      mockDb.queueSelect([{ id: 'food-1', name: 'Apple' }]);
      await startRename('  Broccoli  ');

      await waitFor(() => expect(screen.getByLabelText('Rename Broccoli')).toBeTruthy());
      expect(mockDb.writes).toEqual([{ kind: 'update', values: { name: 'Broccoli' } }]);
      expect(screen.queryByLabelText('Food name')).toBeNull();
    });

    it('releases the rename latch after a failure so a retry re-queries', async () => {
      queueLoad();
      await renderLoaded();
      mockDb.failReads();
      await startRename('Broccoli');
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toBe('Error');

      const readsAfterFirst = mockDb.selectCount();
      await click('Save food name');
      await waitFor(() => expect(mockDb.selectCount()).toBeGreaterThan(readsAfterFirst));
    });

    it('abandons the draft when the parent cancels', async () => {
      queueLoad();
      await renderLoaded();
      fireEvent.click(screen.getByLabelText('Rename Apple'));
      fireEvent.change(screen.getByLabelText('Food name'), { target: { value: 'Typo' } });
      await click('Cancel renaming food');

      await waitFor(() => expect(screen.getByLabelText('Rename Apple')).toBeTruthy());
      expect(mockDb.writes).toHaveLength(0);
    });
  });

  describe('delete (v0.5.138)', () => {
    it('names the food and its blast radius in the confirm alert', async () => {
      queueLoad();
      await renderLoaded();
      await click('Delete Apple');

      expect(alertSpy).toHaveBeenCalled();
      expect(alertSpy.mock.calls[0][0]).toBe('Delete Food?');
      // Exposures are family-wide per food, so the copy must not let a parent
      // assume the delete is scoped to the selected child.
      expect(alertSpy.mock.calls[0][1]).toContain('every child');
      expect(alertSpy.mock.calls[0][1]).toContain('Apple');
    });

    it('deletes nothing until the destructive button is pressed', async () => {
      queueLoad();
      await renderLoaded();
      await click('Delete Apple');

      expect(mockDb.writes).toHaveLength(0);
      await confirmAlert(alertSpy, 'Cancel');
      expect(mockDb.writes).toHaveLength(0);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('runs the dependents-first cascade and leaves the screen on confirm', async () => {
      queueLoad();
      await renderLoaded();
      await click('Delete Apple');
      await confirmAlert(alertSpy, 'Delete');

      // food_chains, then exposures, then the food row itself — the ordering
      // itself is pinned by cascade-delete.test.ts; here we pin that the
      // screen actually runs the cascade rather than a bare food delete.
      expect(mockDb.writes).toEqual([{ kind: 'delete' }, { kind: 'delete' }, { kind: 'delete' }]);
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/foods');
    });
  });
});
