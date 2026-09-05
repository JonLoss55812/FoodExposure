/**
 * Screen tests for `app/(tabs)/index.tsx` — the dashboard, and the first
 * screen a parent sees on every launch.
 *
 * The load-bearing untested logic is the *summary* wiring. Three numbers are
 * derived here and nowhere else, from three different reads:
 *
 *  - **Foods Tracked** (v0.5.85) is `new Set(allExposures.map(e => e.foodId)).size`,
 *    deliberately *not* the sum of the stage-distribution buckets. The buckets
 *    come from `computeStageCounts`, which skips exposures whose stage is not
 *    in `STAGE_ORDER` — correct for the distribution grid (an unknown stage has
 *    no column to render in) and wrong for a "how many foods have we tried"
 *    count, because a food with only unknown-stage rows is still a tried food.
 *    The two numbers only diverge when such a row exists, so a test that does
 *    not create one cannot tell the fixed code from the bug.
 *  - **Today's Exposures** comes from its own date-scoped query, not from the
 *    recent-activity list, so it must be read off the second query's result.
 *  - the **stage distribution** buckets each food at its *highest* reached
 *    stage — one food with three exposures is one entry, not three.
 *
 * Harness: the v0.5.146 seams plus the v0.5.148 tab-screen additions
 * (`useFocusEffect` mocked to a plain `useEffect`, `SafeArea` wrapper), from
 * `src/test-utils/screen-helpers` (v0.5.151).
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

import DashboardScreen from '../index';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const CHILD_ID = 'child-1';
const EMMA = { id: CHILD_ID, familyId: 'fam-1', name: 'Emma', avatarEmoji: '👧' };

/**
 * Queue the four reads `loadData` issues, in the order the screen makes them:
 * children, today's exposures, recent exposures (joined), all exposures.
 */
function queueLoad(opts: {
  children?: unknown[];
  today?: unknown[];
  recent?: unknown[];
  all?: unknown[];
}) {
  mockDb.queueSelect(opts.children ?? [EMMA]);
  mockDb.queueSelect(opts.today ?? []);
  mockDb.queueSelect(opts.recent ?? []);
  mockDb.queueSelect(opts.all ?? []);
}

function renderScreen() {
  return render(
    <SafeArea>
      <DashboardScreen />
    </SafeArea>,
  );
}

function exposure(over: Record<string, unknown>) {
  return { id: 'e-x', foodId: 'food-1', stage: 'tolerate', ...over };
}

describe('DashboardScreen', () => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the child selector and the summary row once loaded', async () => {
    queueLoad({});
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText('Select Emma')).toBeTruthy());
    expect(screen.getByLabelText("Today's Exposures: 0")).toBeTruthy();
    expect(screen.getByLabelText('Foods Tracked: 0')).toBeTruthy();
    expect(screen.getByLabelText('Log new food exposure')).toBeTruthy();
  });

  it("reads Today's Exposures from the date-scoped query, not the recent list", async () => {
    queueLoad({
      // Three rows today; the recent list is deliberately longer, so a screen
      // that counted `recent` instead would report 4.
      today: [exposure({ id: 'e1' }), exposure({ id: 'e2' }), exposure({ id: 'e3' })],
      recent: [
        { id: 'e1', foodId: 'food-1', foodName: 'Apple', childName: 'Emma', stage: 'taste', rating: null, notes: null, occurredAt: new Date() },
        { id: 'e0', foodId: 'food-1', foodName: 'Apple', childName: 'Emma', stage: 'smell', rating: null, notes: null, occurredAt: new Date() },
      ],
      all: [exposure({ id: 'e1' })],
    });
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText("Today's Exposures: 3")).toBeTruthy());
  });

  it('counts Foods Tracked as distinct foods, not exposures', async () => {
    queueLoad({
      all: [
        exposure({ id: 'e1', foodId: 'food-1', stage: 'tolerate' }),
        exposure({ id: 'e2', foodId: 'food-1', stage: 'smell' }),
        exposure({ id: 'e3', foodId: 'food-2', stage: 'taste' }),
      ],
    });
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText('Foods Tracked: 2')).toBeTruthy());
  });

  it('counts a food whose only exposures carry an unknown stage (v0.5.85)', async () => {
    // The load-bearing case: `computeStageCounts` skips food-2 entirely
    // (its stage is not in STAGE_ORDER), so the pre-v0.5.85 sum-of-buckets
    // count reported 1. A tried food is tried even if its stage is
    // unclassifiable, so the correct answer is 2.
    queueLoad({
      all: [
        exposure({ id: 'e1', foodId: 'food-1', stage: 'taste' }),
        exposure({ id: 'e2', foodId: 'food-2', stage: 'mystery' }),
      ],
    });
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText('Foods Tracked: 2')).toBeTruthy());
    // ...while the distribution grid still shows only the classifiable one.
    expect(screen.getByLabelText('Taste stage: 1 food')).toBeTruthy();
    expect(screen.getByLabelText('Tolerate stage: 0 foods')).toBeTruthy();
  });

  it('buckets each food at its highest reached stage', async () => {
    queueLoad({
      all: [
        // One food, three exposures — one entry in the grid, at `taste`.
        exposure({ id: 'e1', foodId: 'food-1', stage: 'tolerate' }),
        exposure({ id: 'e2', foodId: 'food-1', stage: 'taste' }),
        exposure({ id: 'e3', foodId: 'food-1', stage: 'smell' }),
        exposure({ id: 'e4', foodId: 'food-2', stage: 'tolerate' }),
      ],
    });
    renderScreen();

    await waitFor(() => expect(screen.getByText('Stage Distribution')).toBeTruthy());
    expect(screen.getByLabelText('Taste stage: 1 food')).toBeTruthy();
    expect(screen.getByLabelText('Tolerate stage: 1 food')).toBeTruthy();
    expect(screen.getByLabelText('Smell stage: 0 foods')).toBeTruthy();
  });

  it('hides the Stage Distribution section when nothing is bucketed', async () => {
    queueLoad({ all: [] });
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText('Foods Tracked: 0')).toBeTruthy());
    expect(screen.queryByText('Stage Distribution')).toBeNull();
  });

  it('renders recent exposures and routes to the food on tap', async () => {
    queueLoad({
      recent: [
        {
          id: 'e1',
          foodId: 'food-7',
          foodName: 'Broccoli',
          childName: 'Emma',
          stage: 'smell',
          rating: null,
          notes: null,
          occurredAt: new Date(),
        },
      ],
    });
    renderScreen();

    await waitFor(() => expect(screen.getByText('Broccoli')).toBeTruthy());
    await click('Open Broccoli details');
    expect(mockRouter.push).toHaveBeenCalledWith('/food/food-7');
  });

  it('shows the no-exposures copy when the child has logged nothing', async () => {
    queueLoad({});
    renderScreen();

    await waitFor(() => expect(screen.getByText('Recent Activity')).toBeTruthy());
    expect(
      screen.getByText('No exposures logged yet. Start by logging your first food exposure!'),
    ).toBeTruthy();
  });

  it('shows the add-child empty state and issues no exposure queries', async () => {
    // An empty family: `ensureSelection([])` leaves the selection null, so the
    // screen must bail before the three child-scoped reads. A second read
    // would drain to [] and pass silently, so assert the read count.
    //
    // The selection starts null here on purpose. With a child selected,
    // `ensureSelection([])` clears it, which changes `loadData`'s dependency
    // and re-runs the focus effect — a second *children* read, still no
    // child-scoped one. Starting null keeps the read count unambiguous, so a
    // regression that reached the exposures query is the only way to move it.
    useChildStore.getState().clear();
    mockDb.queueSelect([]);
    renderScreen();

    await waitFor(() => expect(screen.getByText('Add Your First Child')).toBeTruthy());
    expect(mockDb.selectCount()).toBe(1);
    expect(screen.queryByLabelText('Foods Tracked: 0')).toBeNull();

    await click('Add Child');
    expect(mockRouter.push).toHaveBeenCalledWith('/child/add');
  });

  it('alerts and renders no summary when the load fails', async () => {
    mockDb.failReads(new Error('db down'));
    renderScreen();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    expect(screen.queryByLabelText('Foods Tracked: 0')).toBeNull();
  });

  it('redirects to onboarding and renders nothing when not onboarded', async () => {
    useAuthStore.getState().setOnboarded(false);
    renderScreen();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding'));
    expect(screen.queryByText('TongueTutor')).toBeNull();
    // The focus effect must early-return too — a query behind the redirect
    // would race the unmount.
    expect(mockDb.selectCount()).toBe(0);
  });
});
