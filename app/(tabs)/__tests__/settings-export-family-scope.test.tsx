/**
 * Family scoping of the Settings CSV export, run against **real SQL**.
 *
 * The export reads the child — and then that child's whole exposure history —
 * by `selectedChildId` alone. That id comes from MMKV, and nothing on this
 * screen repairs it against the signed-in family (only the tab layout does,
 * on focus). On a shared device after Sign Out and Join Family, a stale id is
 * enough to hand the other family's feeding history to the share sheet under
 * this parent's name. `createMockDb` never evaluates a `where`, so the guard
 * is only observable here, through `createSqliteDb()` + `seedTwoFamilies`.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Alert, Share } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';
import { SafeArea, click } from '@/src/test-utils/screen-helpers';

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

import SettingsScreen from '../settings';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

async function renderSettings() {
  await act(async () => {
    render(
      <SafeArea>
        <SettingsScreen />
      </SafeArea>
    );
  });
  await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy());
}

describe('SettingsScreen export family scoping (real SQL)', () => {
  let alertSpy: jest.SpyInstance;
  let shareSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    useAuthStore.getState().login({
      userId: 'u1',
      familyId: 'f1',
      email: 'a@x.app',
      displayName: 'A',
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    shareSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it("exports the signed-in family's own selected child", async () => {
    useChildStore.getState().selectChild('c1');
    await renderSettings();

    await click('Export data as CSV');

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const { title, message } = shareSpy.mock.calls[0][0] as { title: string; message: string };
    expect(title).toMatch(/^tonguetutor-emma-\d{8}\.csv$/);
    expect(message).toContain('Apple');
    expect(message).toContain('Pear');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("refuses to export another family's child left selected in the store", async () => {
    useChildStore.getState().selectChild('c9');
    await renderSettings();

    await click('Export data as CSV');

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('No child selected');
    // Sharing here would send family f2's Kiwi history to a therapist as if
    // it were this parent's child's.
    expect(shareSpy).not.toHaveBeenCalled();
  });
});
