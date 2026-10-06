/**
 * Family scoping of the child detail screen, run against **real SQL**.
 *
 * v0.5.183 scoped the load by family as well as id, but recorded the guard as
 * held "by inspection only": `createMockDb` serves queued rows without
 * evaluating a `where`. Here the screen reads and writes through
 * `createSqliteDb()`, seeded with two families, so the predicate is executed.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

import ChildDetailScreen from '../[id]';
import { useAuthStore } from '@/src/stores/auth-store';

async function renderChild(id: string) {
  mockParams = { id };
  await act(async () => {
    render(<ChildDetailScreen />);
  });
}

const nameOf = (id: string) =>
  (mockSqlite.raw.prepare('SELECT name FROM children WHERE id = ?').get(id) as { name: string }).name;

describe('ChildDetailScreen family scoping (real SQL)', () => {
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

  it("opens the signed-in family's own child, seeded from the row", async () => {
    await renderChild('c1');
    await waitFor(() => expect(screen.getByLabelText('Save Changes')).toBeTruthy());
    expect((screen.getByLabelText("Child's name") as HTMLInputElement).value).toBe('Emma');
  });

  it("reads another family's child as Child Not Found and offers no Save", async () => {
    await renderChild('c9');
    await waitFor(() => expect(screen.getByText('Child Not Found')).toBeTruthy());
    expect(screen.queryByLabelText('Save Changes')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('saving rewrites only the opened child, leaving siblings and the other family alone', async () => {
    await renderChild('c1');
    await waitFor(() => expect(screen.getByLabelText('Save Changes')).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: 'Emmy' } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save Changes'));
    });

    expect(nameOf('c1')).toBe('Emmy');
    expect(nameOf('c2')).toBe('Leo');
    expect(nameOf('c9')).toBe('Other');
  });
});
