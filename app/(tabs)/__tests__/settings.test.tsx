/**
 * Screen tests for the Settings tab's Family card — specifically the
 * v0.5.139 Delete Child flow, the app's other irreversible cascade.
 *
 * Deleting a child discards every exposure that child ever logged, and the
 * flow then has to repair the store's selection: if the deleted child was
 * the selected one, `ensureSelection` must fall through to a remaining
 * child (or to null when none remain, where the dashboard's EmptyState
 * takes over). That repair is the part a hand-rolled
 * `if (selectedChildId === child.id) clear()` would get wrong, and until
 * now nothing exercised it through the screen at all.
 *
 * Seams follow `app/onboarding/__tests__/join.test.tsx`, plus one addition:
 * `useFocusEffect` is mocked to a plain `useEffect` so the focus-driven
 * load actually runs under the harness, and the screen is wrapped in a
 * `SafeAreaProvider` with static metrics — `SafeAreaView` throws without
 * one, so every tab screen test will need that wrapper.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Alert, Share } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { SafeArea, click, confirmAlert } from '@/src/test-utils/screen-helpers';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  // The real hook re-runs the callback on navigation focus; under the
  // harness the screen mounts once, so a plain effect is equivalent.
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

import SettingsScreen from '../settings';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const EMMA = { id: 'child-1', name: 'Emma', avatarEmoji: '👧' };
const NOAH = { id: 'child-2', name: 'Noah', avatarEmoji: '👦' };

async function renderWithChildren(children: unknown[]) {
  mockDb.queueSelect(children);
  await act(async () => {
    render(
      <SafeArea>
        <SettingsScreen />
      </SafeArea>
    );
  });
  await waitFor(() => expect(screen.getByText('Settings')).toBeTruthy());
}

describe('SettingsScreen — Delete Child (v0.5.139)', () => {
  let alertSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.getState().login({
      userId: 'user-1',
      familyId: 'fam-1',
      email: 'anne@tonguetutor.app',
      displayName: 'Anne',
    });
    useChildStore.getState().selectChild(EMMA.id);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    errorSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it('lists each child in the family with its own delete action', async () => {
    await renderWithChildren([EMMA, NOAH]);
    expect(screen.getByLabelText('Delete Emma')).toBeTruthy();
    expect(screen.getByLabelText('Delete Noah')).toBeTruthy();
  });

  it('names the child and its blast radius in the confirm alert', async () => {
    await renderWithChildren([EMMA, NOAH]);
    await click('Delete Emma');

    expect(alertSpy.mock.calls[0][0]).toBe('Delete Child?');
    expect(alertSpy.mock.calls[0][1]).toContain('Emma');
    expect(alertSpy.mock.calls[0][1]).toContain('permanently deleted');
  });

  it('deletes nothing when the parent cancels', async () => {
    await renderWithChildren([EMMA, NOAH]);
    await click('Delete Emma');
    await confirmAlert(alertSpy, 'Cancel');

    expect(mockDb.writes).toHaveLength(0);
    expect(screen.getByLabelText('Delete Emma')).toBeTruthy();
    expect(useChildStore.getState().selectedChildId).toBe(EMMA.id);
  });

  it('runs the cascade, drops the row, and moves the selection to a survivor', async () => {
    await renderWithChildren([EMMA, NOAH]);
    await click('Delete Emma');
    await confirmAlert(alertSpy, 'Delete');

    // food_chains, then exposures, then the child row — the ordering itself
    // is pinned by cascade-delete.test.ts; here we pin that the screen runs
    // the cascade rather than a bare child delete that would orphan rows.
    expect(mockDb.writes).toEqual([{ kind: 'delete' }, { kind: 'delete' }, { kind: 'delete' }]);
    await waitFor(() => expect(screen.queryByLabelText('Delete Emma')).toBeNull());
    expect(screen.getByLabelText('Delete Noah')).toBeTruthy();
    // The deleted child was the selected one, so the selection must move.
    expect(useChildStore.getState().selectedChildId).toBe(NOAH.id);
  });

  it('clears the selection when the last child is deleted', async () => {
    await renderWithChildren([EMMA]);
    await click('Delete Emma');
    await confirmAlert(alertSpy, 'Delete');

    await waitFor(() => expect(useChildStore.getState().selectedChildId).toBeNull());
  });

  it('leaves the selection alone when a different child is deleted', async () => {
    await renderWithChildren([EMMA, NOAH]);
    await click('Delete Noah');
    await confirmAlert(alertSpy, 'Delete');

    await waitFor(() => expect(screen.queryByLabelText('Delete Noah')).toBeNull());
    expect(useChildStore.getState().selectedChildId).toBe(EMMA.id);
  });

  it('keeps the row in a retryable state when the cascade fails', async () => {
    await renderWithChildren([EMMA, NOAH]);
    const failing = createMockDb();
    failing.failReads();
    // Make the cascade's first delete reject, leaving the child row present.
    (failing.db as { delete: unknown }).delete = () => ({
      where: () => Promise.reject(new Error('delete failed')),
    });
    mockDb = failing;

    await click('Delete Emma');
    await confirmAlert(alertSpy, 'Delete');

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
    expect(alertSpy.mock.calls[1][0]).toBe('Error');
    expect(screen.getByLabelText('Delete Emma')).toBeTruthy();
    expect(useChildStore.getState().selectedChildId).toBe(EMMA.id);
  });

  it('renders no delete rows when the family has no children', async () => {
    await renderWithChildren([]);
    expect(screen.queryByLabelText('Delete Emma')).toBeNull();
    expect(screen.getByLabelText('Add child')).toBeTruthy();
  });
});

/**
 * The CSV export is the only surface where a parent's logged data leaves the
 * app — it is how a feeding therapist receives the exposure history, and
 * NEXT_STEPS names it as the documented sharing path. The screen half of it
 * (child-name lookup, then the share sheet) shipped unverified: the helpers
 * in `src/lib/export.ts` are unit-tested, but nothing checked that the screen
 * feeds them the *selected* child, or that a failed read is reported rather
 * than producing a silently empty export.
 *
 * `Share.share` is spied rather than stubbed out of the module, so these
 * exercise the real `exportChildData` -> `fetchExportRows` ->
 * `formatExposuresCsv` chain against the mock db.
 */
describe('SettingsScreen — Export Data', () => {
  let alertSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let shareSpy: jest.SpyInstance;

  const EXPOSURE_ROW = {
    occurredAt: new Date('2026-05-10T12:00:00Z'),
    foodName: 'Broccoli',
    category: 'vegetable',
    isSafeFood: false,
    stage: 'taste',
    rating: 4,
    preparation: 'steamed',
    texture: 'soft',
    temperature: 'warm',
    mealType: 'dinner',
    setting: 'home',
    notes: 'ate two florets',
  };

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as never);
    useAuthStore.getState().login({
      userId: 'user-1',
      familyId: 'fam-1',
      email: 'anne@tonguetutor.app',
      displayName: 'Anne',
    });
    useChildStore.getState().selectChild(EMMA.id);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    errorSpy.mockRestore();
    shareSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  it('shares a CSV of the selected child\'s exposures, named after that child', async () => {
    await renderWithChildren([EMMA, NOAH]);
    mockDb.queueSelect([{ name: 'Emma' }]); // the child-name lookup
    mockDb.queueSelect([EXPOSURE_ROW]); // fetchExportRows

    await click('Export data as CSV');

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const { title, message } = shareSpy.mock.calls[0][0] as {
      title: string;
      message: string;
    };
    // The filename carries the child's name, so a therapist receiving two
    // exports from the same parent can tell them apart.
    expect(title).toMatch(/^tonguetutor-emma-\d{8}\.csv$/);
    expect(message).toContain('Broccoli');
    expect(message).toContain('taste');
    expect(message).toContain('ate two florets');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('refuses to export when no child is selected, without reading anything', async () => {
    // Cleared before mount: a post-mount clear does not reach the handler's
    // closure under this harness, and the read count would be ambiguous.
    useChildStore.getState().clear();
    await renderWithChildren([EMMA]);
    const readsBefore = mockDb.selectCount();

    await click('Export data as CSV');

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('No child selected');
    // A read scoped to a null childId would quietly return every child's
    // rows — one family's whole history in a file labelled as one child's.
    expect(mockDb.selectCount()).toBe(readsBefore);
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('reports a failed read instead of sharing an empty file', async () => {
    await renderWithChildren([EMMA]);
    mockDb.failReads();

    await click('Export data as CSV');

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Export failed');
    // Sharing a header-only CSV here would look to a therapist exactly like
    // a parent who has logged nothing.
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('stays retryable after a failure', async () => {
    await renderWithChildren([EMMA]);
    const failing = createMockDb();
    failing.failReads();
    (mockDb.db as { select: unknown }).select = (failing.db as { select: () => unknown }).select;

    await click('Export data as CSV');
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    // The latch is released in `finally`, so the second tap gets through.
    const restored = createMockDb();
    restored.queueSelect([{ name: 'Emma' }]);
    restored.queueSelect([EXPOSURE_ROW]);
    (mockDb.db as { select: unknown }).select = (restored.db as { select: () => unknown }).select;

    await click('Export data as CSV');
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
  });
});
