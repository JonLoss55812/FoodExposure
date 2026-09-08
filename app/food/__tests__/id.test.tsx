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
import { click, confirmAlert } from '@/src/test-utils/screen-helpers';

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

  describe('category (v0.5.159)', () => {
    it('opens a chip row from the category tag', async () => {
      queueLoad();
      await renderLoaded();

      expect(screen.queryByLabelText('Category: Protein')).toBeNull();
      await click('Change category, currently Fruit');
      expect(screen.getByLabelText('Category: Protein')).toBeTruthy();
      expect(screen.getByLabelText('Category: Fruit')).toBeTruthy();
    });

    it('persists the picked category and reflects it in the tag', async () => {
      queueLoad();
      await renderLoaded();

      await click('Change category, currently Fruit');
      await click('Category: Vegetable');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(mockDb.writes[0]).toEqual({ kind: 'update', values: { category: 'vegetable' } });
      // Local state is patched too, so the tag and the icon follow without a
      // reload — the screen has no focus effect to refetch on.
      expect(screen.getByLabelText('Change category, currently Vegetable')).toBeTruthy();
      expect(screen.queryByLabelText('Category: Vegetable')).toBeNull();
    });

    it('closes without a write when the current category is re-picked', async () => {
      queueLoad();
      await renderLoaded();

      await click('Change category, currently Fruit');
      await click('Category: Fruit');

      // A no-op update would still bump `foods` for no reason; more to the
      // point, the row must not be reachable as a write with no change.
      expect(mockDb.writes).toHaveLength(0);
      expect(screen.queryByLabelText('Category: Protein')).toBeNull();
    });

    it('alerts on a failed write and leaves the row open to retry', async () => {
      queueLoad();
      await renderLoaded();

      let failNext = true;
      (mockDb.db as { update: unknown }).update = () => ({
        set: (values: unknown) => ({
          where: () => {
            if (failNext) return Promise.reject(new Error('update failed'));
            mockDb.writes.push({ kind: 'update' as const, values });
            return Promise.resolve();
          },
        }),
      });

      await click('Change category, currently Fruit');
      await click('Category: Grain');

      expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to change category'));
      // Still Fruit, and the chip row is still open, so the retry is one tap.
      expect(screen.getByLabelText('Change category, currently Fruit')).toBeTruthy();

      // The latch is released in `finally`, so the retry is not stranded.
      failNext = false;
      await click('Category: Grain');
      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(screen.getByLabelText('Change category, currently Grain')).toBeTruthy();
    });
  });

  describe('default preparation (v0.5.161)', () => {
    it('offers to set a preparation when the food has none', async () => {
      queueLoad();
      await renderLoaded();

      expect(screen.queryByLabelText('Preparation: Steamed')).toBeNull();
      await click('Set default preparation');
      expect(screen.getByLabelText('Preparation: Steamed')).toBeTruthy();
      expect(screen.getByLabelText('Preparation: Raw')).toBeTruthy();
    });

    it('persists the picked preparation and reflects it in the tag', async () => {
      queueLoad();
      await renderLoaded();

      await click('Set default preparation');
      await click('Preparation: Steamed');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      // Stored lowercase (the schema/constant shape), displayed title-cased.
      expect(mockDb.writes[0]).toEqual({
        kind: 'update',
        values: { defaultPreparation: 'steamed' },
      });
      expect(screen.getByLabelText('Change preparation, currently Steamed')).toBeTruthy();
      expect(screen.queryByLabelText('Preparation: Steamed')).toBeNull();
    });

    it('clears the preparation when the selected chip is re-tapped', async () => {
      // The load-bearing difference from the category editor: this field is
      // nullable, so "not recorded" is a legal state and must stay reachable.
      // A no-op-on-re-tap (the category shape) would make a mis-tap permanent.
      queueLoad({ ...FOOD, defaultPreparation: 'baked' });
      await renderLoaded();

      await click('Change preparation, currently Baked');
      await click('Preparation: Baked');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(mockDb.writes[0]).toEqual({
        kind: 'update',
        values: { defaultPreparation: null },
      });
      expect(screen.getByLabelText('Set default preparation')).toBeTruthy();
    });

    it('replaces an existing preparation with a different one', async () => {
      queueLoad({ ...FOOD, defaultPreparation: 'baked' });
      await renderLoaded();

      await click('Change preparation, currently Baked');
      await click('Preparation: Fried');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(mockDb.writes[0]).toEqual({
        kind: 'update',
        values: { defaultPreparation: 'fried' },
      });
      expect(screen.getByLabelText('Change preparation, currently Fried')).toBeTruthy();
    });

    it('alerts on a failed write and leaves the row open to retry', async () => {
      queueLoad();
      await renderLoaded();

      let failNext = true;
      (mockDb.db as { update: unknown }).update = () => ({
        set: (values: unknown) => ({
          where: () => {
            if (failNext) return Promise.reject(new Error('update failed'));
            mockDb.writes.push({ kind: 'update' as const, values });
            return Promise.resolve();
          },
        }),
      });

      await click('Set default preparation');
      await click('Preparation: Roasted');

      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('Failed to change preparation'),
      );
      // Unchanged, and the row is still open, so the retry is one tap.
      expect(screen.getByLabelText('Set default preparation')).toBeTruthy();

      // The latch is released in `finally`, so the retry is not stranded.
      failNext = false;
      await click('Preparation: Roasted');
      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(screen.getByLabelText('Change preparation, currently Roasted')).toBeTruthy();
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

  /**
   * The bump-stage action (v0.2.0) is the app's second write path and the
   * only one reachable without opening the Log form. Every row it writes is
   * counted toward the 15/20/30 acceptance threshold and moves the food
   * through the SOS hierarchy, so two things have to hold: it must write the
   * *next* stage rather than the current one, and it must never write at all
   * without a selected child.
   */
  describe('bump stage (v0.2.0)', () => {
    /** An exposure row as the screen's second read projects it. */
    const exposureAt = (stage: string) => ({
      id: `exp-${stage}`,
      stage,
      rating: null,
      notes: null,
      occurredAt: new Date(0),
      mealType: null,
      temperature: null,
      texture: null,
      setting: null,
    });

    async function tapBump(label: string) {
      await act(async () => {
        fireEvent.click(screen.getByLabelText(label));
      });
    }

    it('offers the entry stage for a food with no exposures and records it', async () => {
      queueLoad();
      await renderLoaded();
      queueLoad(); // the reload the handler runs after the insert

      await tapBump('Bump to Tolerate');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      const values = (mockDb.writes[0] as { values: Record<string, unknown> }).values;
      expect(values).toEqual(
        expect.objectContaining({
          childId: 'child-1',
          foodId: 'food-1',
          stage: 'tolerate',
          // A one-tap bump records no dimensions; "not recorded" has to
          // round-trip as absent, not as an empty string or a 0 rating.
          rating: null,
          mealType: null,
          notes: null,
        }),
      );
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('advances one step past the highest stage already reached', async () => {
      // The load-bearing case: writing the *current* stage would add an
      // exposure toward the threshold without moving the hierarchy, which
      // reads on screen as the bump having silently done nothing.
      queueLoad(FOOD, [exposureAt('tolerate'), exposureAt('smell')]);
      await renderLoaded();
      queueLoad();

      await tapBump('Bump to Touch');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect((mockDb.writes[0] as { values: { stage: string } }).values.stage).toBe('touch');
    });

    it('does not offer a bump past the top of the hierarchy', async () => {
      queueLoad(FOOD, [exposureAt('eat')]);
      await renderLoaded();

      expect(screen.queryByLabelText(/^Bump to /)).toBeNull();
      expect(mockDb.writes).toHaveLength(0);
    });

    it('does not offer a bump when no child is selected', async () => {
      // An exposure row with a blank childId is dropped silently by every
      // downstream join, so the action must be unreachable rather than a
      // no-op handler behind a live button.
      useChildStore.getState().clear();
      queueLoad();
      await renderLoaded();

      expect(screen.queryByLabelText(/^Bump to /)).toBeNull();
      // Limit recorded rather than papered over: the handler's own
      // `!selectedChildId` early return is defence-in-depth behind this
      // render gate, so relaxing it alone leaves the suite green — with no
      // child there is no button to press. The gate is what is observable.
    });

    it('alerts on a failed bump and stays retryable', async () => {
      let failNext = true;
      (mockDb.db as { insert: unknown }).insert = () => ({
        values: (values: unknown) => {
          if (failNext) return Promise.reject(new Error('insert failed'));
          mockDb.writes.push({ kind: 'insert', values });
          return Promise.resolve();
        },
      });

      queueLoad();
      await renderLoaded();
      await tapBump('Bump to Tolerate');

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toBe('Error');

      // The latch is released in `finally`, so the retry gets through.
      failNext = false;
      queueLoad();
      await tapBump('Bump to Tolerate');
      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    });
  });

  /**
   * The safe-food flag (v0.3.0) is what pins a food to the Foods tab's
   * preferred row — the SOS "safe food kept available alongside new
   * targets". The toggle patches local state rather than reloading, so the
   * on-screen state and the persisted value can drift apart.
   */
  describe('safe food toggle (v0.3.0)', () => {
    it('persists the flip and follows it on screen', async () => {
      queueLoad();
      await renderLoaded();
      expect(screen.getByText('Mark as Safe Food')).toBeTruthy();

      await click('Mark as safe food');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(mockDb.writes[0]).toEqual({ kind: 'update', values: { isSafeFood: true } });
      // Read through the toggle's own description, which is unique — the
      // header also grows a "Safe Food" badge once the flag is on.
      expect(screen.getByText('Pinned to the top of the Foods tab')).toBeTruthy();
    });

    it('unmarks a food that is already pinned', async () => {
      // Without this, a mis-tapped safe food is permanent: the flag drives
      // the Foods tab's preferred row, and there is no other surface to
      // clear it from.
      queueLoad({ ...FOOD, isSafeFood: true });
      await renderLoaded();
      expect(screen.getByText('Pinned to the top of the Foods tab')).toBeTruthy();

      await click('Mark as safe food');

      await waitFor(() => expect(mockDb.writes).toHaveLength(1));
      expect(mockDb.writes[0]).toEqual({ kind: 'update', values: { isSafeFood: false } });
      expect(screen.getByText('A food your child already accepts')).toBeTruthy();
    });

    it('leaves the on-screen state on the old value when the write fails', async () => {
      (mockDb.db as { update: unknown }).update = () => ({
        set: () => ({ where: () => Promise.reject(new Error('update failed')) }),
      });

      queueLoad();
      await renderLoaded();
      await click('Mark as safe food');

      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      expect(alertSpy.mock.calls[0][0]).toBe('Error');
      // Showing the pinned copy after a failed write would tell the parent
      // the food is pinned when the Foods tab will not pin it.
      expect(screen.getByText('Mark as Safe Food')).toBeTruthy();
      expect(screen.queryByText('Pinned to the top of the Foods tab')).toBeNull();
    });
  });

});
