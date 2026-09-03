/**
 * Screen tests for `app/food/add.tsx` (NEXT_STEPS gap #1).
 *
 * Built on the v0.5.146 harness (`createMockDb` + the documented seams).
 * The load-bearing untested logic here is the v0.5.136 duplicate-name guard:
 * a second `foods` row for the same food silently splits the per-food
 * exposure count that the 15/20/30 acceptance threshold is read from, and
 * the split is invisible until it can no longer be fixed cheaply. The guard
 * shipped screen-level and therefore unverified.
 *
 * See `app/onboarding/__tests__/join.test.tsx` for the seam rationale, and
 * NEXT_STEPS gap #1 for the harness gotchas (mock-prefixed router variable,
 * getter-based db mock, `getByLabelText` + `fireEvent.change`).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { pressAlertButton } from '@/src/test-utils/screen-helpers';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import AddFoodScreen from '../add';
import { useAuthStore } from '@/src/stores/auth-store';

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('Food name'), { target: { value } });
}

function tapAdd() {
  fireEvent.click(screen.getByLabelText('Add Food'));
}

describe('AddFoodScreen', () => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the name field, the category grid and the submit action', () => {
    render(<AddFoodScreen />);
    expect(screen.getByLabelText('Food name')).toBeTruthy();
    expect(screen.getByLabelText('Category: Fruit')).toBeTruthy();
    expect(screen.getByLabelText('Add Food')).toBeTruthy();
  });

  it('rejects a whitespace-only name through the schema and issues no query', async () => {
    render(<AddFoodScreen />);
    typeName('   ');
    tapAdd();

    // foodSchema.name is `.trim().min(1)` (v0.5.75) — the guard belongs to the
    // schema, so the screen must not reach the database at all.
    await waitFor(() => expect(screen.getByText('Food name is required')).toBeTruthy());
    expect(mockDb.selectCount()).toBe(0);
    expect(mockDb.writes).toHaveLength(0);
  });

  it('blocks a case-insensitive duplicate, names the existing row, and writes nothing', async () => {
    mockDb.queueSelect([{ id: 'food-1', name: 'Apple' }]);
    render(<AddFoodScreen />);
    typeName('apple');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Already Added');
    // Naming the colliding row is what points the parent at the real next
    // action (log an exposure on the existing food) instead of a dead end.
    expect(alertSpy.mock.calls[0][1]).toContain('Apple');
    expect(mockDb.writes).toHaveLength(0);
  });

  it('blocks a duplicate that differs only by surrounding whitespace', async () => {
    mockDb.queueSelect([{ id: 'food-1', name: 'Broccoli' }]);
    render(<AddFoodScreen />);
    typeName('  Broccoli  ');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Already Added');
    expect(mockDb.writes).toHaveLength(0);
  });

  it('inserts the trimmed name scoped to the family when there is no collision', async () => {
    mockDb.queueSelect([{ id: 'food-1', name: 'Apple' }]);
    render(<AddFoodScreen />);
    typeName('  Pear  ');
    tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const write = mockDb.writes[0] as { kind: string; values: Record<string, unknown> };
    expect(write.kind).toBe('insert');
    expect(write.values.name).toBe('Pear');
    expect(write.values.familyId).toBe('fam-1');
    expect(write.values.category).toBe('other');
    expect(write.values.isSafeFood).toBe(false);
    expect(write.values.defaultPreparation).toBeNull();
    expect(alertSpy.mock.calls[0][0]).toBe('Added!');
  });

  it('persists the selected category and the safe-food flag', async () => {
    render(<AddFoodScreen />);
    typeName('Yogurt');
    fireEvent.click(screen.getByLabelText('Category: Dairy'));
    fireEvent.click(screen.getByLabelText('Mark as safe food'));
    tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const write = mockDb.writes[0] as { kind: string; values: Record<string, unknown> };
    expect(write.values.category).toBe('dairy');
    expect(write.values.isSafeFood).toBe(true);
  });

  it('clears the form when the parent chooses Add Another', async () => {
    render(<AddFoodScreen />);
    typeName('Pear');
    fireEvent.click(screen.getByLabelText('Category: Dairy'));
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    // v0.5.16: batch-adding foods must not require deleting the previous name.
    await pressAlertButton(alertSpy, 'Add Another');

    await waitFor(() =>
      expect((screen.getByLabelText('Food name') as HTMLInputElement).value).toBe(''),
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('navigates back when the parent chooses Done', async () => {
    render(<AddFoodScreen />);
    typeName('Pear');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await pressAlertButton(alertSpy, 'Done');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('alerts and writes nothing when the duplicate lookup fails', async () => {
    mockDb.failReads();
    render(<AddFoodScreen />);
    typeName('Pear');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    // A failed read must not fall through to the insert — that would be a
    // back door around the duplicate guard on exactly the flaky path.
    expect(mockDb.writes).toHaveLength(0);
  });

  it('releases the in-flight latch after a failure so a retry re-queries', async () => {
    mockDb.failReads();
    render(<AddFoodScreen />);
    typeName('Pear');
    tapAdd();
    await waitFor(() => expect(mockDb.selectCount()).toBe(1));

    tapAdd();
    await waitFor(() => expect(mockDb.selectCount()).toBe(2));
  });
});
