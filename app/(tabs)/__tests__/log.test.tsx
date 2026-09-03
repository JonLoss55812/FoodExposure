/**
 * Screen tests for `app/(tabs)/log.tsx` — the Log Exposure form, the last of
 * NEXT_STEPS gap #1's named targets and the app's primary write path.
 *
 * Every exposure the app ever records is inserted by this one handler, and
 * the row it writes is what the 15/20/30 acceptance threshold, the stage
 * distribution, and the therapist-facing CSV export are all computed from.
 * Two things here are load-bearing and shipped unverified: the child/food
 * required-selection guards (an insert with a blank id would be an orphan
 * row that every downstream join drops silently), and the v0.5.142 repair
 * that clears a `foodId` naming a food deleted since the last load — the
 * form outlives the list, so without it Save persists an orphan exposure.
 *
 * Seams follow `app/(tabs)/__tests__/settings.test.tsx`: mock-prefixed
 * router spy, `useFocusEffect` mocked to a plain `useEffect`, getter-based
 * db mock, and the `SafeAreaProvider` wrapper that `SafeAreaView` requires.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

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

import LogExposureScreen from '../log';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const EMMA = { id: 'child-1', name: 'Emma', avatarEmoji: '👧' };
const APPLE = { id: 'food-1', name: 'Apple' };
const PEAR = { id: 'food-2', name: 'Pear' };

/** Queue the two reads `loadData` issues, in order: children, then foods. */
function queueLoad(children: unknown[], foods: unknown[]) {
  mockDb.queueSelect(children);
  mockDb.queueSelect(foods);
}

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <LogExposureScreen />
    </SafeAreaProvider>,
  );
}

function tapSave() {
  fireEvent.click(screen.getByLabelText('Save Exposure'));
}

function lastInsert() {
  const write = mockDb.writes[mockDb.writes.length - 1] as {
    kind: string;
    values: Record<string, unknown>;
  };
  expect(write.kind).toBe('insert');
  return write.values;
}

describe('LogExposureScreen', () => {
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
    useChildStore.getState().selectChild(EMMA.id);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the loaded children and foods as selectable chips', async () => {
    queueLoad([EMMA], [APPLE, PEAR]);
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText('Select Apple')).toBeTruthy());
    expect(screen.getByLabelText('Select Emma')).toBeTruthy();
    expect(screen.getByLabelText('Select Pear')).toBeTruthy();
  });

  it('shows the add-food call to action when the family has no foods', async () => {
    queueLoad([EMMA], []);
    renderScreen();

    await waitFor(() =>
      expect(screen.getByLabelText('Add foods to start logging exposures')).toBeTruthy(),
    );
  });

  it('blocks Save with no food selected and writes nothing', async () => {
    queueLoad([EMMA], [APPLE]);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Select Apple')).toBeTruthy());

    tapSave();

    // A blank foodId would insert an exposure row that every downstream
    // join drops silently — the schema owns the rejection, the screen must
    // surface it inline and never reach the insert.
    await waitFor(() => expect(screen.getByText('Select a food')).toBeTruthy());
    expect(mockDb.writes).toHaveLength(0);
  });

  it('blocks Save with no child selected and writes nothing', async () => {
    useChildStore.getState().clear();
    queueLoad([], [APPLE]);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Select Apple')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Select Apple'));
    tapSave();

    await waitFor(() => expect(screen.getByText('Select a child')).toBeTruthy());
    expect(mockDb.writes).toHaveLength(0);
  });

  it('inserts the exposure with the selected child, food and stage', async () => {
    queueLoad([EMMA], [APPLE, PEAR]);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Select Pear')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Select Pear'));
    fireEvent.click(screen.getByLabelText('Stage: Smell'));
    tapSave();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const values = lastInsert();
    expect(values.childId).toBe(EMMA.id);
    expect(values.foodId).toBe(PEAR.id);
    expect(values.stage).toBe('smell');
    expect(values.loggedBy).toBe('user-1');
    // The optional dimensions are `.optional()` in the schema and nullable
    // in SQLite; "not recorded" has to land as null, not as ''.
    expect(values.rating).toBeNull();
    expect(values.notes).toBeNull();
    expect(alertSpy.mock.calls[0][0]).toBe('Logged!');
  });

  it('defaults the stage to tolerate, the entry level of the hierarchy', async () => {
    queueLoad([EMMA], [APPLE]);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Select Apple')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Select Apple'));
    tapSave();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    expect(lastInsert().stage).toBe('tolerate');
  });

  it('keeps the child but clears the food after a successful save', async () => {
    queueLoad([EMMA], [APPLE]);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Select Apple')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Select Apple'));
    tapSave();
    await waitFor(() => expect(mockDb.writes).toHaveLength(1));

    // v0.5.7: a parent logs several short exposures per meal, so the child
    // must survive the reset while the food must not (logging the same food
    // twice by accident double-counts toward the acceptance threshold).
    tapSave();
    await waitFor(() => expect(screen.getByText('Select a food')).toBeTruthy());
    expect(screen.queryByText('Select a child')).toBeNull();
    expect(mockDb.writes).toHaveLength(1);
  });

  it('alerts on a failed load and renders no food chips', async () => {
    mockDb.failReads();
    renderScreen();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    expect(screen.queryByLabelText('Select Apple')).toBeNull();
  });

  it('alerts and does not clear the form when the insert fails', async () => {
    queueLoad([EMMA], [APPLE]);
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Select Apple')).toBeTruthy());

    const chip = screen.getByLabelText('Select Apple');
    // Fail the insert only, after the load has already resolved.
    (mockDb.db as { insert: unknown }).insert = () => ({
      values: () => Promise.reject(new Error('insert failed')),
    });
    fireEvent.click(chip);
    tapSave();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    // The selection survives, so the parent can retry without re-tapping:
    // the form was not reset, so Save re-validates cleanly rather than
    // surfacing the "Select a food" error. (react-native-web does not
    // serialize `accessibilityState.selected`, so the chip's highlight is
    // not assertable directly — the retry is the observable behaviour.)
    expect(screen.queryByText('Select a food')).toBeNull();
    tapSave();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Select a food')).toBeNull();
  });
});
