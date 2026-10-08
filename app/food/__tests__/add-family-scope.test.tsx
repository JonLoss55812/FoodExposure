/**
 * The Add Food duplicate guard (v0.5.136) against **real SQL**.
 *
 * `add.test.tsx` queues the sibling rows the guard compares against, so it
 * cannot see which family's library the guard actually reads. Scoped too
 * wide, another family's "Kiwi" on a shared device blocks this family from
 * ever adding kiwi; scoped wrong, a real duplicate slips in and splits the
 * exposure count the acceptance threshold is read from.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import AddFoodScreen from '../add';
import { useAuthStore } from '@/src/stores/auth-store';

function addFood(name: string) {
  render(<AddFoodScreen />);
  fireEvent.change(screen.getByLabelText('Food name'), { target: { value: name } });
  fireEvent.click(screen.getByLabelText('Add Food'));
}

const foodNames = (familyId: string) =>
  mockSqlite.raw
    .prepare('SELECT name FROM foods WHERE family_id = ? ORDER BY name')
    .all(familyId)
    .map((r) => (r as { name: string }).name);

describe('AddFoodScreen duplicate guard scoping (real SQL)', () => {
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
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useAuthStore.getState().logout();
  });

  it("adds a food that only another family's library contains", async () => {
    addFood('kiwi');

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Added!');
    expect(foodNames('f1')).toEqual(['Apple', 'Pear', 'kiwi']);
    expect(foodNames('f2')).toEqual(['Fig', 'Kiwi']);
  });

  it("blocks a case-only duplicate of this family's own food", async () => {
    addFood('  apple ');

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Already Added');
    expect(foodNames('f1')).toEqual(['Apple', 'Pear']);
  });
});
