/**
 * The Log Exposure form — the app's primary write path — against **real SQL**.
 *
 * `log.test.tsx` checks the values handed to a recording fake. Two things it
 * cannot see: which family's children and foods the chip rows are read from
 * (`createMockDb` never evaluates a `where`), and whether the row the form
 * builds is one the shipped schema actually accepts — the CHECK constraints
 * on every enum dimension, `occurred_at > 0`, and the foreign keys on child,
 * food and `logged_by` that have been enforced since v0.5.193. A chip whose
 * value drifts from the CHECK list, or a store id that no longer matches a
 * row, fails here the way it would on a device: as a "Failed to save" toast.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';
import { SafeArea } from '@/src/test-utils/screen-helpers';

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

import LogExposureScreen from '../log';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

async function renderLog() {
  await act(async () => {
    render(
      <SafeArea>
        <LogExposureScreen />
      </SafeArea>
    );
  });
  await waitFor(() => expect(screen.getByLabelText('Select Pear')).toBeTruthy());
}

describe('LogExposureScreen (real SQL)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.getState().login({
      userId: 'u1',
      familyId: 'f1',
      email: 'a@x.app',
      displayName: 'A',
    });
    useChildStore.getState().selectChild('c1');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it("offers only the signed-in family's children and foods", async () => {
    await renderLog();

    expect(screen.getByLabelText('Select Emma')).toBeTruthy();
    expect(screen.getByLabelText('Select Leo')).toBeTruthy();
    expect(screen.getByLabelText('Select Apple')).toBeTruthy();
    // Family f2's child and foods must not be loggable from this family.
    expect(screen.queryByLabelText('Select Other')).toBeNull();
    expect(screen.queryByLabelText('Select Kiwi')).toBeNull();
    expect(screen.queryByLabelText('Select Fig')).toBeNull();
  });

  it('persists a fully detailed exposure that the shipped schema accepts', async () => {
    await renderLog();

    fireEvent.click(screen.getByLabelText('Select Pear'));
    fireEvent.click(screen.getByLabelText('Stage: Smell'));
    fireEvent.click(screen.getByLabelText('Show additional details'));
    fireEvent.click(screen.getByLabelText('Meal: Breakfast'));
    fireEvent.click(screen.getByLabelText('Temperature: Hot'));
    fireEvent.click(screen.getByLabelText('Texture: Crunchy'));
    fireEvent.click(screen.getByLabelText('Setting: Therapy'));
    fireEvent.change(screen.getByLabelText('Notes (optional)'), {
      target: { value: 'sniffed it, then pushed it away' },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save Exposure'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Logged!');

    const { raw, ids } = mockSqlite;
    const [newId] = ids('exposures', "id NOT IN ('e1', 'e2', 'e3', 'e9')");
    const row = raw.prepare('SELECT * FROM exposures WHERE id = ?').get(newId) as Record<
      string,
      unknown
    >;
    expect(row).toMatchObject({
      child_id: 'c1',
      food_id: 'pear',
      stage: 'smell',
      meal_type: 'breakfast',
      temperature: 'hot',
      texture: 'crunchy',
      setting: 'therapy',
      notes: 'sniffed it, then pushed it away',
      rating: null,
      logged_by: 'u1',
    });
    // drizzle's `mode: 'timestamp'` stores whole **seconds** since the epoch,
    // not milliseconds. Any raw-SQL comparison against this column has to
    // use the same unit (see the dashboard's today count).
    expect(Math.abs((row.occurred_at as number) - Date.now() / 1000)).toBeLessThan(60);
    expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
