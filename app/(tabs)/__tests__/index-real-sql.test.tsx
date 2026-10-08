/**
 * The dashboard's "Today's Exposures" count against **real SQL**.
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

async function logAt(id: string, childId: string, at: Date) {
  await mockSqlite.db.insert(schema.exposures).values({
    id,
    childId,
    foodId: 'apple',
    stage: 'touch',
    loggedBy: 'u1',
    occurredAt: at,
    createdAt: at,
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
});
