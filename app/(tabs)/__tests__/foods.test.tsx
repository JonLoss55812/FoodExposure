/**
 * Screen tests for `app/(tabs)/foods.tsx` — the food library, and the entry
 * point for every food-detail navigation in the app.
 *
 * The load-bearing untested logic here is the *read* path's three-way split.
 * The screen composes four pure helpers that are each unit-tested in
 * isolation (`buildFoodsWithStats`, `filterFoods`, `partitionSafeFoods`,
 * `getEmptyStateKind`) but nothing checked that the screen wires them
 * together correctly, and the wiring is where the user-visible mistakes live:
 *
 *  - the v0.5.2 fix that distinguishes "you have no foods" from "your filter
 *    matched none" — showing the "Add Food" CTA on a filtered-empty list
 *    actively nudges a parent into creating a duplicate row, which is the
 *    exact defect the v0.5.136 duplicate guard exists to prevent;
 *  - the v0.3.0 safe-foods row, which is pinned *above* the list and must
 *    therefore not also appear in it (the SOS "preferred food stays
 *    available alongside the target" surface);
 *  - the exposure counts, which come from a *second* query keyed on the
 *    selected child and must not be issued at all when no child is selected.
 *
 * Harness: the v0.5.146 seams plus the v0.5.148 tab-screen additions
 * (`useFocusEffect` mocked to a plain `useEffect`, `SafeArea` wrapper), now
 * imported from `src/test-utils/screen-helpers` rather than copied (v0.5.151).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { SafeArea, click, confirmAlert } from '@/src/test-utils/screen-helpers';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
}));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import FoodsScreen from '../foods';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const CHILD_ID = 'child-1';

function food(over: Record<string, unknown>) {
  return {
    id: 'food-x',
    familyId: 'fam-1',
    name: 'Food',
    category: 'other',
    isSafeFood: false,
    defaultPreparation: null,
    createdAt: new Date(),
    ...over,
  };
}

const APPLE = food({ id: 'food-1', name: 'Apple', category: 'fruit' });
const BROCCOLI = food({ id: 'food-2', name: 'Broccoli', category: 'vegetable' });
const CHICKEN = food({ id: 'food-3', name: 'Chicken', category: 'protein', isSafeFood: true });

/** Queue the two reads `loadFoods` issues, in order: foods, then exposures. */
function queueLoad(foods: unknown[], exposures: unknown[] = []) {
  mockDb.queueSelect(foods);
  mockDb.queueSelect(exposures);
}

function renderScreen() {
  return render(
    <SafeArea>
      <FoodsScreen />
    </SafeArea>,
  );
}

async function search(text: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Search foods'), { target: { value: text } });
  });
}

describe('FoodsScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      userId: 'user-1',
      familyId: 'fam-1',
      email: 'anne@tonguetutor.app',
      displayName: 'Anne',
    });
    useChildStore.getState().selectChild(CHILD_ID);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the loaded foods', async () => {
    queueLoad([APPLE, BROCCOLI]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());
    expect(screen.getByText('Broccoli')).toBeTruthy();
  });

  it('pins a safe food above the list and does not repeat it in the list', async () => {
    queueLoad([APPLE, CHICKEN]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('⭐ Safe Foods')).toBeTruthy());
    // The pinned chip is the only place the safe food appears — a duplicate
    // would mean `partitionSafeFoods` was not applied to the list data.
    expect(screen.getAllByText('Chicken')).toHaveLength(1);
    expect(screen.getByLabelText('Open Chicken details')).toBeTruthy();
    expect(screen.getByText('Apple')).toBeTruthy();
  });

  it('omits the safe-foods section when the family has none', async () => {
    queueLoad([APPLE, BROCCOLI]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());
    expect(screen.queryByText('⭐ Safe Foods')).toBeNull();
  });

  it('counts exposures per food from the selected child', async () => {
    queueLoad(
      [APPLE, BROCCOLI],
      [
        { id: 'e1', foodId: APPLE.id, childId: CHILD_ID, stage: 'taste' },
        { id: 'e2', foodId: APPLE.id, childId: CHILD_ID, stage: 'smell' },
      ],
    );
    renderScreen();

    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());
    // FoodCard renders the count through ProgressBar's "current/target"
    // label, whose target is the component's default 15.
    expect(screen.getByText('2/15')).toBeTruthy();
    expect(screen.getByText('0/15')).toBeTruthy();
  });

  it('does not query exposures when no child is selected', async () => {
    useChildStore.getState().selectChild(null as unknown as string);
    // Only one read is queued; a second would drain to [] and pass silently,
    // so assert on the recorded read count instead of the render.
    mockDb.queueSelect([APPLE]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());
    expect(mockDb.selectCount()).toBe(1);
  });

  it('narrows the list by search, case-insensitively', async () => {
    queueLoad([APPLE, BROCCOLI]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());

    await search('brocc');

    expect(screen.getByText('Broccoli')).toBeTruthy();
    expect(screen.queryByText('Apple')).toBeNull();
  });

  it('narrows the list by category', async () => {
    queueLoad([APPLE, BROCCOLI]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());

    await click('Filter by Vegetable');

    expect(screen.getByText('Broccoli')).toBeTruthy();
    expect(screen.queryByText('Apple')).toBeNull();
  });

  it('shows the add-food empty state when the family has no foods at all', async () => {
    queueLoad([]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('No Foods Yet')).toBeTruthy());
    expect(screen.queryByText('No Matches')).toBeNull();

    await click('Add Food');
    expect(mockRouter.push).toHaveBeenCalledWith('/food/add');
  });

  it('shows the no-matches empty state — not the add-food CTA — when a filter matches nothing', async () => {
    queueLoad([APPLE, BROCCOLI]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());

    await search('zzz');

    // The v0.5.2 distinction: offering "Add Food" here nudges a parent into
    // creating a duplicate of a food they already have but cannot see.
    expect(screen.getByText('No Matches')).toBeTruthy();
    expect(screen.queryByText('No Foods Yet')).toBeNull();
  });

  it('Clear Filters restores the full list', async () => {
    queueLoad([APPLE, BROCCOLI]);
    renderScreen();
    await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());

    await search('zzz');
    await waitFor(() => expect(screen.getByText('No Matches')).toBeTruthy());

    await click('Clear Filters');

    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Broccoli')).toBeTruthy();
  });

  it('alerts and renders no foods when the load fails', async () => {
    mockDb.failReads();
    renderScreen();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    expect(screen.queryByText('Apple')).toBeNull();
  });

  /**
   * The duplicate banner (NEXT_STEPS gap #2(a)). v0.5.176 made merging
   * lossless but reachable only from a rename *collision*, so a family with
   * legacy casing twins had no way to discover the problem existed.
   */
  describe('duplicate banner', () => {
    const APPLE_LOWER = food({ id: 'food-9', name: 'apple', category: 'fruit' });

    it('stays absent when no two foods share a name', async () => {
      queueLoad([APPLE, BROCCOLI]);
      renderScreen();

      await waitFor(() => expect(screen.getByText('Apple')).toBeTruthy());
      expect(screen.queryByLabelText('Merge duplicates of Apple')).toBeNull();
    });

    it('names the food and its copy count when a casing twin exists', async () => {
      queueLoad([APPLE, APPLE_LOWER, BROCCOLI]);
      renderScreen();

      await waitFor(() =>
        expect(screen.getByLabelText('Merge duplicates of Apple')).toBeTruthy(),
      );
      expect(
        screen.getByText(
          '"Apple" is in your library 2 times. Merging keeps every logged exposure.',
        ),
      ).toBeTruthy();
    });

    it('stays visible when a search hides one of the twins', async () => {
      // Duplication is a property of the library, not of the current filter —
      // a filter that hides one twin must not read as "the problem is gone".
      queueLoad([APPLE, APPLE_LOWER, BROCCOLI]);
      renderScreen();

      await waitFor(() => expect(screen.getByText('Broccoli')).toBeTruthy());
      await search('Broccoli');

      expect(screen.getByLabelText('Merge duplicates of Apple')).toBeTruthy();
    });

    it('names both spellings in the confirm and writes nothing on Cancel', async () => {
      queueLoad([APPLE, APPLE_LOWER]);
      renderScreen();

      await waitFor(() =>
        expect(screen.getByLabelText('Merge duplicates of Apple')).toBeTruthy(),
      );
      await click('Merge duplicates of Apple');

      expect(alertSpy).toHaveBeenCalled();
      const [title, body] = alertSpy.mock.calls[0];
      expect(title).toBe('Merge Duplicates?');
      expect(body).toContain('"apple"');
      expect(body).toContain('"Apple"');
      expect(body).toContain('Nothing is lost');
      expect(mockDb.writes).toHaveLength(0);
    });

    it('merges the later twin into the first and reloads without it', async () => {
      queueLoad([APPLE, APPLE_LOWER]);
      // The reload that follows a successful merge.
      queueLoad([APPLE]);
      renderScreen();

      await waitFor(() =>
        expect(screen.getByLabelText('Merge duplicates of Apple')).toBeTruthy(),
      );
      await click('Merge duplicates of Apple');
      await confirmAlert(alertSpy, 'Merge');

      // mergeFoods issues its five writes; the last is the source row delete.
      await waitFor(() => expect(mockDb.writes.length).toBe(5));
      expect(mockDb.writes.map((w) => w.kind)).toEqual([
        'update',
        'update',
        'update',
        'delete',
        'delete',
      ]);
      // The exposures reassignment moves rows onto the *surviving* row.
      const first = mockDb.writes[0];
      expect(first.kind === 'update' && first.values).toEqual({ foodId: APPLE.id });
      await waitFor(() =>
        expect(screen.queryByLabelText('Merge duplicates of Apple')).toBeNull(),
      );
    });

    it('alerts and keeps both rows when the merge fails', async () => {
      queueLoad([APPLE, APPLE_LOWER]);
      renderScreen();

      await waitFor(() =>
        expect(screen.getByLabelText('Merge duplicates of Apple')).toBeTruthy(),
      );
      // `failReads()` covers reads only, so the merge's catch block is
      // reached by replacing `update` for the duration of the attempt — the
      // v0.5.159 inline pattern.
      const realUpdate = (mockDb.db as { update: unknown }).update;
      (mockDb.db as { update: unknown }).update = () => {
        throw new Error('update failed');
      };
      await click('Merge duplicates of Apple');
      await confirmAlert(alertSpy, 'Merge');
      (mockDb.db as { update: unknown }).update = realUpdate;

      await waitFor(() =>
        expect(alertSpy.mock.calls.some((c) => c[0] === 'Error')).toBe(true),
      );
      // Still offered, so the retry is one tap.
      expect(screen.getByLabelText('Merge duplicates of Apple')).toBeTruthy();
    });
  });
});
