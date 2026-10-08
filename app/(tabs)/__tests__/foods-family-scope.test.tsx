/**
 * Family and child scoping of the Foods tab, run against **real SQL**.
 *
 * `foods.test.tsx` drives this screen through `createMockDb`, which serves
 * queued rows without evaluating a `where` — so nothing there can see whether
 * the library read is scoped to the signed-in family, or the exposure counts
 * to the selected child. Here that scoping is load-bearing for more than
 * display: the v0.5.177 merge banner is computed from the loaded library, and
 * its Merge action calls `mergeFoods`, which moves exposures and deletes a
 * `foods` row. On a shared device (Sign Out, then Join Family) an unscoped
 * read would show another family's foods, call two families' "Apple" rows
 * duplicates, and offer to fold one family's history into the other's.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';
import { SafeArea, click, confirmAlert } from '@/src/test-utils/screen-helpers';

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

import FoodsScreen from '../foods';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

async function renderFoods() {
  await act(async () => {
    render(
      <SafeArea>
        <FoodsScreen />
      </SafeArea>
    );
  });
  await waitFor(() => expect(screen.getByText('Pear')).toBeTruthy());
}

describe('FoodsScreen family scoping (real SQL)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
    // Family f2 also has an "Apple", with history of its own. Same name, a
    // different family: not a duplicate, and never this parent's to merge.
    mockSqlite.raw.exec(`
      INSERT INTO foods (id, family_id, name, category, created_at) VALUES
        ('apple9', 'f2', 'Apple', 'fruit', 1);
      INSERT INTO exposures (id, child_id, food_id, stage, occurred_at, created_at) VALUES
        ('e99', 'c9', 'apple9', 'taste', 14, 1);
    `);
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

  it("lists only the signed-in family's foods and does not call another family's Apple a duplicate", async () => {
    await renderFoods();

    expect(screen.getAllByText('Apple')).toHaveLength(1);
    expect(screen.queryByText('Kiwi')).toBeNull();
    expect(screen.queryByText('Fig')).toBeNull();
    expect(screen.queryByTestId('duplicate-banner')).toBeNull();
  });

  it("counts only the selected child's exposures", async () => {
    await renderFoods();

    // c1 has one Apple (e1) and one Pear (e3). Leo's Apple (e2) and family
    // f2's Apple (e99) must not reach Emma's counts toward the threshold.
    expect(screen.getAllByText('1/15')).toHaveLength(2);
    expect(screen.queryByText('2/15')).toBeNull();
  });

  it("merges an in-family twin without touching the other family's rows", async () => {
    mockSqlite.raw.exec(`
      INSERT INTO foods (id, family_id, name, category, created_at) VALUES
        ('apple-dup', 'f1', 'apple', 'fruit', 1);
      INSERT INTO exposures (id, child_id, food_id, stage, occurred_at, created_at) VALUES
        ('e4', 'c1', 'apple-dup', 'taste', 15, 1);
    `);
    await renderFoods();

    // Binary collation sorts "Apple" before "apple", so the survivor is the
    // original row and the lowercase twin is folded into it.
    await click('Merge duplicates of Apple');
    await confirmAlert(alertSpy, 'Merge');

    await waitFor(() => expect(screen.queryByTestId('duplicate-banner')).toBeNull());
    const { raw, ids } = mockSqlite;
    expect(ids('foods')).toEqual(['apple', 'apple9', 'fig', 'kiwi', 'pear']);
    expect(ids('exposures', "food_id = 'apple'")).toEqual(['e1', 'e2', 'e4']);
    // Family f2's Apple and its history are exactly as they were.
    expect(ids('exposures', "food_id = 'apple9'")).toEqual(['e99']);
    expect(raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    // The reloaded list shows Emma's merged count: e1 + e4.
    expect(screen.getByText('2/15')).toBeTruthy();
  });
});
