/**
 * The dashboard's reads against **real SQL**: today's count, the children list,
 * stage distribution and recent activity.
 *
 * `index.test.tsx` queues the rows the date-scoped query returns, so the
 * date predicate itself is never evaluated. It matters because it is the one
 * raw-SQL comparison against a timestamp column in the app, and drizzle's
 * `integer(..., { mode: 'timestamp' })` stores whole **seconds** — a bound in
 * milliseconds is ~1000x too large and matches nothing. Rows are written here
 * through drizzle itself, so the fixture uses whatever encoding the app does.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';
import { SafeArea } from '@/src/test-utils/screen-helpers';
import * as schema from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { getStartOfDay } from '@/src/lib/utils';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
}));

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import DashboardScreen from '../index';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const HOUR = 60 * 60 * 1000;

async function logAt(id: string, childId: string, at: Date, foodId = 'apple', createdAt = at) {
  await mockSqlite.db.insert(schema.exposures).values({
    id,
    childId,
    foodId,
    stage: 'touch',
    loggedBy: 'u1',
    occurredAt: at,
    createdAt,
  });
}

async function renderDashboard() {
  await act(async () => {
    render(
      <SafeArea>
        <DashboardScreen />
      </SafeArea>
    );
  });
}

describe('DashboardScreen today count (real SQL)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.getState().login({
      userId: 'u1',
      familyId: 'f1',
      email: 'a@x.app',
      displayName: 'A',
    });
    useAuthStore.getState().setOnboarded(true);
    useChildStore.getState().selectChild('c1');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it("counts the selected child's exposures logged since local midnight", async () => {
    const midnight = getStartOfDay().getTime();
    await logAt('t1', 'c1', new Date(midnight + 1000));
    await logAt('t2', 'c1', new Date());
    // Not today, and not this child: neither may be counted.
    await logAt('y1', 'c1', new Date(midnight - HOUR));
    await logAt('t9', 'c2', new Date());

    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText("Today's Exposures: 2")).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  /**
   * The dashboard's reads are keyed by child id alone; what keeps them inside
   * the family is the `ensureSelection(kids)` call that repairs the persisted
   * MMKV selection against this family's children *before* the child-scoped
   * reads run. A stale id from another family (shared device, Sign Out then
   * Join Family) must therefore never reach those reads — otherwise the home
   * screen shows that family's counts and recent foods.
   */
  it("repairs another family's selected child before reading anything by it", async () => {
    useChildStore.getState().selectChild('c9');
    await logAt('t1', 'c1', new Date());
    await logAt('t8', 'c9', new Date(), 'kiwi');
    await logAt('t9', 'c9', new Date(), 'fig');

    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText("Today's Exposures: 1")).toBeTruthy());
    expect(useChildStore.getState().selectedChildId).toBe('c1');
    // Recent activity: this child's food is listed, the other family's are not.
    await waitFor(() => expect(screen.getAllByLabelText('Open Apple details').length).toBeGreaterThan(0));
    expect(screen.queryByLabelText('Open Kiwi details')).toBeNull();
    expect(screen.queryByLabelText('Open Fig details')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  // Two rows backdated to the same day share local midnight. Recent activity
  // must list the later-logged one first, whichever was inserted first, or the
  // order (and which row LIMIT 10 drops) is left to the planner.
  it.each([
    ['older row inserted first', ['old', 'new'] as const],
    ['newer row inserted first', ['new', 'old'] as const],
  ])('lists exposures tied on occurredAt newest-logged first (%s)', async (_label, order) => {
    const yesterday = new Date(getStartOfDay().getTime() - 24 * HOUR);
    const rows = {
      old: () => logAt('t-old', 'c1', yesterday, 'apple', new Date(Date.now() - 2 * HOUR)),
      new: () => logAt('t-new', 'c1', yesterday, 'pear', new Date(Date.now() - HOUR)),
    };
    for (const key of order) await rows[key]();

    await renderDashboard();

    await waitFor(() => expect(screen.getAllByLabelText(/^Open (Apple|Pear) details$/).length).toBe(4));
    // The seed's own c1 rows (pear, then apple) are from 1970 and come after.
    expect(
      screen.getAllByLabelText(/^Open (Apple|Pear) details$/).map((el) => el.getAttribute('aria-label')),
    ).toEqual(['Open Pear details', 'Open Apple details', 'Open Pear details', 'Open Apple details']);
  });

  // The children read is the one dashboard read keyed by family rather than
  // child; it feeds both the selector and the `ensureSelection` repair above.
  it("lists only this family's children in the selector", async () => {
    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText('Select Emma')).toBeTruthy());
    expect(screen.getByLabelText('Select Leo')).toBeTruthy();
    expect(screen.queryByLabelText('Select Other')).toBeNull();
  });

  // Seed: c1 has apple at touch and pear at eat. A sibling's apple at eat and
  // the other family's kiwi must not lift apple to Eat or count as tracked.
  it("counts stage distribution and foods tracked from the selected child's rows only", async () => {
    await logAt('s2', 'c2', new Date(), 'apple');
    await mockSqlite.db.update(schema.exposures).set({ stage: 'eat' })
      .where(eq(schema.exposures.id, 's2'));

    await renderDashboard();

    await waitFor(() => expect(screen.getByLabelText('Foods Tracked: 2')).toBeTruthy());
    expect(screen.getByLabelText('Touch stage: 1 food')).toBeTruthy();
    expect(screen.getByLabelText('Eat stage: 1 food')).toBeTruthy();
    expect(screen.getByLabelText('Smell stage: 0 foods')).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('caps recent activity at the ten newest exposures', async () => {
    for (let i = 0; i < 12; i++) await logAt(`r${i}`, 'c1', new Date(Date.now() - i * HOUR));

    await renderDashboard();

    await waitFor(() => expect(screen.getAllByLabelText(/^Open (Apple|Pear) details$/).length).toBe(10));
    // All ten are the fresh rows; the seed's 1970 pear (the only Pear) is cut.
    expect(screen.queryByLabelText('Open Pear details')).toBeNull();
  });
});
