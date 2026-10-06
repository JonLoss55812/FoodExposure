/**
 * Family scoping of the food detail load, run against **real SQL**.
 *
 * `createMockDb` serves queued rows without evaluating a `where`, so a load
 * that forgot the family predicate passes there. Here the screen reads through
 * `createSqliteDb()`, seeded with two families, so a route param naming the
 * *other* family's food has to come back as Food Not Found — otherwise its
 * rename, merge and delete-cascade actions are one tap away on another
 * family's history (a shared device after sign-out / join is enough).
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import FoodDetailScreen from '../[id]';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

async function renderFood(id: string) {
  mockParams = { id };
  await act(async () => {
    render(<FoodDetailScreen />);
  });
}

describe('FoodDetailScreen family scoping (real SQL)', () => {
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
    useChildStore.getState().selectChild('c1');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it("opens the signed-in family's own food", async () => {
    await renderFood('apple');
    await waitFor(() => expect(screen.getByLabelText('Rename Apple')).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("reads another family's food as Food Not Found and offers none of its actions", async () => {
    await renderFood('kiwi');
    await waitFor(() => expect(screen.getByText('Food Not Found')).toBeTruthy());
    expect(screen.queryByLabelText('Rename Kiwi')).toBeNull();
    expect(screen.queryByLabelText('Delete Kiwi')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('reads as Food Not Found with nobody signed in', async () => {
    useAuthStore.getState().logout();
    await renderFood('apple');
    await waitFor(() => expect(screen.getByText('Food Not Found')).toBeTruthy());
  });
});
