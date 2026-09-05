/**
 * Screen tests for `app/(tabs)/progress.tsx` — the therapist-facing view, and
 * the last of NEXT_STEPS gap #1's named tab targets.
 *
 * `calcProgressStats` is already unit-tested in isolation; what was untested is
 * how the screen *presents* it, and two of those presentation choices are
 * clinically load-bearing:
 *
 *  - **The threshold shown must follow the feeding profile.** It is 15/20/30
 *    for typical/picky/ARFID, it appears in two places (the section header tag
 *    and every per-food row), and those two must agree — a parent reading
 *    "3/20" under a header that says 15 has no way to know which number the
 *    app is actually counting toward. Only a non-default profile separates a
 *    correct implementation from one that hardcodes 15, so the picky test is
 *    the one that does the work here.
 *  - **The three early-return branches are distinguishable states.** "No child
 *    selected" and "no exposures yet" are different problems with different
 *    cures, and each empty state routes at its own fix; the pre-v0.5.35 screen
 *    rendered an all-zeros dashboard for the second one.
 *
 * Harness: the v0.5.146 seams plus the v0.5.148 tab-screen additions, imported
 * from `src/test-utils/screen-helpers` (v0.5.151).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { SafeArea, click } from '@/src/test-utils/screen-helpers';

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

import ProgressScreen from '../progress';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { useSettingsStore } from '@/src/stores/settings-store';

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

function exposure(over: Record<string, unknown>) {
  return {
    id: 'e-x',
    childId: CHILD_ID,
    foodId: 'food-1',
    stage: 'tolerate',
    rating: null,
    occurredAt: new Date(),
    ...over,
  };
}

/** Queue the two reads `loadStats` issues, in order: foods, then exposures. */
function queueLoad(foods: unknown[], exposures: unknown[] = []) {
  mockDb.queueSelect(foods);
  mockDb.queueSelect(exposures);
}

/** `n` exposures against one food, so its per-food row reads `n/threshold`. */
function exposuresFor(foodId: string, n: number, over: Record<string, unknown> = {}) {
  return Array.from({ length: n }, (_, i) => exposure({ id: `${foodId}-${i}`, foodId, ...over }));
}

/**
 * The value of a summary stat card, read through its label. A bare
 * `getByText('3')` is ambiguous — the same digit shows up in the stage rows
 * and category tiles — so scope the assertion to the card that owns the label.
 */
function statValue(label: string): string {
  const el = screen.getByText(label);
  return (el.parentElement?.textContent ?? '').replace(label, '');
}

function renderScreen() {
  return render(
    <SafeArea>
      <ProgressScreen />
    </SafeArea>,
  );
}

describe('ProgressScreen', () => {
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
    useAuthStore.getState().setOnboarded(true);
    useChildStore.getState().selectChild(CHILD_ID);
    useSettingsStore.getState().setFeedingProfile('typical');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the summary cards from the loaded stats', async () => {
    queueLoad(
      [food({ id: 'food-1', name: 'Apple' }), food({ id: 'food-2', name: 'Pear' })],
      [
        exposure({ id: 'e1', foodId: 'food-1' }),
        exposure({ id: 'e2', foodId: 'food-1' }),
        exposure({ id: 'e3', foodId: 'food-2' }),
      ],
    );
    renderScreen();

    await waitFor(() => expect(screen.getByText('Total Exposures')).toBeTruthy());
    expect(statValue('Total Exposures')).toBe('3');
    expect(statValue('Foods Tried')).toBe('2');
    expect(statValue('This Week')).toBe('3');
  });

  it('shows the Select a Child empty state and issues no queries', async () => {
    useChildStore.getState().clear();
    renderScreen();

    await waitFor(() => expect(screen.getByText('Select a Child')).toBeTruthy());
    // The guard is upstream of both reads — a query here would be scoped to a
    // null childId and quietly return every child's rows.
    expect(mockDb.selectCount()).toBe(0);

    await click('Go to Dashboard');
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)');
  });

  it('shows the No Progress Yet empty state rather than an all-zeros dashboard', async () => {
    // A child with foods in the library but nothing logged. Pre-v0.5.35 this
    // rendered three zero cards and six zero bars, which reads as broken.
    queueLoad([food({ id: 'food-1', name: 'Apple' })], []);
    renderScreen();

    await waitFor(() => expect(screen.getByText('No Progress Yet')).toBeTruthy());
    expect(screen.queryByText('Stage Distribution')).toBeNull();
    expect(screen.queryByText('Total Exposures')).toBeNull();

    await click('Log Exposure');
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/log');
  });

  it('renders a per-food row against the profile threshold', async () => {
    queueLoad([food({ id: 'food-1', name: 'Apple' })], exposuresFor('food-1', 3));
    renderScreen();

    await waitFor(() => expect(screen.getByText('Exposures Toward Acceptance')).toBeTruthy());
    expect(screen.getByText('3/15')).toBeTruthy();
    expect(screen.getByLabelText('Apple exposures progress')).toBeTruthy();
  });

  it('shows the picky threshold in both the header tag and the rows', async () => {
    // Non-default profile on purpose: on `typical` a hardcoded 15 is
    // indistinguishable from a correct read, so this is the case that pins the
    // profile actually reaching the screen.
    //
    // Honest limit, measured rather than assumed: this does *not* separate the
    // v0.5.43 `getThresholdForProfile(feedingProfile)` tag from the
    // `foodProgress[0].threshold ?? 15` it replaced. Reverting that line leaves
    // the suite green, because `calcProgressStats` derives every row's
    // threshold from the same profile and the section is gated on a non-empty
    // list, so the fallback is unreachable. v0.5.43 was a
    // single-source-the-helper refactor against a future per-row override, not
    // a live bug fix, and it is not screen-observable today.
    useSettingsStore.getState().setFeedingProfile('picky');
    queueLoad([food({ id: 'food-1', name: 'Apple' })], exposuresFor('food-1', 3));
    renderScreen();

    await waitFor(() => expect(screen.getByText('Exposures Toward Acceptance')).toBeTruthy());
    expect(screen.getByText('Picky · 20')).toBeTruthy();
    expect(screen.getByText('3/20')).toBeTruthy();
  });

  it('marks a food that has reached its threshold', async () => {
    queueLoad(
      [food({ id: 'food-1', name: 'Apple' }), food({ id: 'food-2', name: 'Pear' })],
      [...exposuresFor('food-1', 15), ...exposuresFor('food-2', 2)],
    );
    renderScreen();

    await waitFor(() => expect(screen.getByText('Exposures Toward Acceptance')).toBeTruthy());
    expect(screen.getByText('✓ Apple')).toBeTruthy();
    // The unreached food carries no marker — a blanket '✓ ' prefix would make
    // the reached state meaningless.
    expect(screen.getByText('Pear')).toBeTruthy();
  });

  it('discloses truncation past the top 10 foods', async () => {
    const foods = Array.from({ length: 12 }, (_, i) =>
      food({ id: `food-${i}`, name: `Food ${i}` }),
    );
    const exposures = foods.flatMap((f) => exposuresFor(f.id as string, 1));
    queueLoad(foods, exposures);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Exposures Toward Acceptance')).toBeTruthy());
    expect(screen.getByText('Showing top 10 of 12')).toBeTruthy();
  });

  it('omits the truncation note when everything fits', async () => {
    queueLoad([food({ id: 'food-1', name: 'Apple' })], exposuresFor('food-1', 2));
    renderScreen();

    await waitFor(() => expect(screen.getByText('Exposures Toward Acceptance')).toBeTruthy());
    expect(screen.queryByText(/Showing top 10 of/)).toBeNull();
  });

  it('shows the acceptance gauge only when a rating has been recorded', async () => {
    queueLoad([food({ id: 'food-1', name: 'Apple' })], exposuresFor('food-1', 2));
    renderScreen();

    await waitFor(() => expect(screen.getByText('Stage Distribution')).toBeTruthy());
    // Every exposure above is unrated, so avgRating is 0 and the gauge — whose
    // whole content is a number out of 5 — must not claim an average of 0.0.
    expect(screen.queryByText('Average Acceptance')).toBeNull();

    mockDb = createMockDb();
    queueLoad(
      [food({ id: 'food-1', name: 'Apple' })],
      [exposure({ id: 'e1', rating: 4 }), exposure({ id: 'e2', rating: 2 })],
    );
    renderScreen();

    await waitFor(() => expect(screen.getByText('Average Acceptance')).toBeTruthy());
    expect(screen.getByText('3.0')).toBeTruthy();
    expect(screen.getByLabelText('Average acceptance rating')).toBeTruthy();
  });

  it('renders the stage distribution across all six stages', async () => {
    queueLoad(
      [food({ id: 'food-1', name: 'Apple' })],
      [exposure({ id: 'e1', stage: 'tolerate' }), exposure({ id: 'e2', stage: 'taste' })],
    );
    renderScreen();

    await waitFor(() => expect(screen.getByText('Stage Distribution')).toBeTruthy());
    // One food, bucketed at its highest stage only.
    expect(screen.getByLabelText('Taste stage food count')).toBeTruthy();
    expect(screen.getByLabelText('Tolerate stage food count')).toBeTruthy();
    expect(screen.getByText('Food Categories')).toBeTruthy();
  });

  it('alerts and renders no stats when the load fails', async () => {
    mockDb.failReads(new Error('db down'));
    renderScreen();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    // Stats stay at their empty default, so the screen falls through to the
    // zero-exposure empty state rather than showing stale or partial numbers.
    expect(screen.queryByText('Total Exposures')).toBeNull();
  });
});
