/**
 * The Progress tab's two reads against **real SQL**.
 *
 * `progress.test.tsx` serves queued rows from `createMockDb`, which never
 * evaluates a `where` — so nothing showed which family's rows the screen
 * actually counts. The exposures read is keyed off the persisted
 * `selectedChildId`, which this screen never repairs (only the tab layout and
 * the dashboard call `ensureSelection`), so a stale selection from a previous
 * sign-in on a shared device must not surface another family's feeding history
 * here — the screen therapists read.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
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

import ProgressScreen from '../progress';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { useSettingsStore } from '@/src/stores/settings-store';

/** A summary card's value, read through the label that owns it. */
function statValue(label: string): string {
  const el = screen.getByText(label);
  return (el.parentElement?.textContent ?? '').replace(label, '');
}

async function renderProgress() {
  await act(async () => {
    render(
      <SafeArea>
        <ProgressScreen />
      </SafeArea>
    );
  });
}

describe('ProgressScreen (real SQL)', () => {
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
    useSettingsStore.getState().setFeedingProfile('typical');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it("counts only the selected child's own exposures", async () => {
    useChildStore.getState().selectChild('c1');
    await renderProgress();

    await waitFor(() => expect(screen.getByText('Total Exposures')).toBeTruthy());
    // c1 has e1 (apple) and e3 (pear); sibling c2's e2 is not counted.
    expect(statValue('Total Exposures')).toBe('2');
    expect(statValue('Foods Tried')).toBe('2');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows nothing of another family's child named by a stale selection", async () => {
    useChildStore.getState().selectChild('c9');
    await renderProgress();

    // c9 belongs to family f2 and has a logged exposure (e9). Read under f1,
    // it must look like a child with no history, not expose f2's count.
    await waitFor(() => expect(screen.getByText('No Progress Yet')).toBeTruthy());
    expect(screen.queryByText('Total Exposures')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
