/**
 * The tab layout's child-selection repair, against **real SQL**.
 *
 * `selectedChildId` is persisted in MMKV and survives a sign-out, so on a
 * shared device it can name another family's child. The Progress tab, the
 * food detail page and the CSV export never repair it themselves — they rely
 * on this layout calling `ensureSelection` with the signed-in family's
 * children (v0.5.201 notes this). Nothing tested that the layout does so, or
 * that it scopes the read by family, or that an empty family is sent back to
 * Add Child.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => {
  const Tabs = () => null;
  Tabs.Screen = () => null;
  return { useRouter: () => mockRouter, Tabs };
});

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import TabLayout from '../_layout';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

function signIn(familyId: string) {
  useAuthStore.getState().login({
    userId: 'u1',
    familyId,
    email: 'a@x.app',
    displayName: 'A',
  });
  useAuthStore.getState().setOnboarded(true);
}

async function renderLayout() {
  await act(async () => {
    render(<TabLayout />);
  });
}

describe('TabLayout selection repair (real SQL)', () => {
  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
    jest.clearAllMocks();
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it("repairs a stale selection naming another family's child", async () => {
    signIn('f1');
    useChildStore.getState().selectChild('c9');
    await renderLayout();

    await waitFor(() =>
      expect(['c1', 'c2']).toContain(useChildStore.getState().selectedChildId)
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("keeps a selection that already names one of this family's children", async () => {
    signIn('f1');
    useChildStore.getState().selectChild('c2');
    await renderLayout();

    // Let the async read settle before asserting nothing changed.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(useChildStore.getState().selectedChildId).toBe('c2');
  });

  it('sends a family with no children back to Add Child', async () => {
    mockSqlite.raw.exec(
      "INSERT INTO families (id, name, invite_code, created_at) VALUES ('f3', 'Three', 'NPQRST', 1);"
    );
    signIn('f3');
    // A child of another family must not count as this family having one.
    useChildStore.getState().selectChild('c1');
    await renderLayout();

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/add-child')
    );
  });

  it('does nothing until onboarding is complete', async () => {
    useAuthStore.getState().login({
      userId: 'u1',
      familyId: 'f1',
      email: 'a@x.app',
      displayName: 'A',
    });
    useChildStore.getState().selectChild('c9');
    await renderLayout();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(useChildStore.getState().selectedChildId).toBe('c9');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
