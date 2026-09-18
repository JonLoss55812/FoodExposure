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
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { Alert, Share } from 'react-native';
import { eq } from 'drizzle-orm';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import * as schema from '@/src/db/schema';
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
import { useSettingsStore } from '@/src/stores/settings-store';

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
    expect(mockDb.writes.map((w) => w.kind)).toEqual(['delete', 'delete', 'delete']);
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
/**
 * The Preferences card and the Sign Out button. Neither was covered, and the
 * Sign Out path is the one that matters: the v0.5.80 contract is that it calls
 * **both** `clearChildSelection()` and `logout()`. Dropping the first leaves
 * the previous family's `selectedChildId` in MMKV, which on a shared device
 * bleeds one family's exposure rows into the next person's first render until
 * `ensureSelection` self-heals against the new children list. That is a
 * privacy leak, it is a single line, and nothing pinned it through the screen.
 * `logout()` must also reset `isOnboarded` (also v0.5.80) or the onboarding
 * flow is skipped for the next person.
 */
describe('SettingsScreen — Preferences and Sign Out', () => {
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
    useAuthStore.setState({ isOnboarded: true });
    useChildStore.getState().selectChild(EMMA.id);
    useSettingsStore.setState({ theme: 'system', feedingProfile: 'typical' });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    errorSpy.mockRestore();
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
    useSettingsStore.setState({ theme: 'system', feedingProfile: 'typical' });
  });

  it('persists a theme choice to the settings store', async () => {
    await renderWithChildren([EMMA]);
    expect(useSettingsStore.getState().theme).toBe('system');

    await click('Theme: Dark');
    expect(useSettingsStore.getState().theme).toBe('dark');

    await click('Theme: Light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('persists a feeding profile choice, which drives the acceptance threshold', async () => {
    // Not cosmetic: the profile is what `getThresholdForProfile` reads, so it
    // moves the 15/20/30 target every per-food progress bar is measured against.
    await renderWithChildren([EMMA]);
    expect(useSettingsStore.getState().feedingProfile).toBe('typical');

    await click('Profile: ARFID');
    expect(useSettingsStore.getState().feedingProfile).toBe('arfid');
  });

  it('asks for confirmation before signing out and changes nothing on cancel', async () => {
    await renderWithChildren([EMMA]);
    await click('Sign out');

    expect(alertSpy).toHaveBeenCalled();
    expect(alertSpy.mock.calls[0][0]).toBe('Sign Out');
    await confirmAlert(alertSpy, 'Cancel');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useChildStore.getState().selectedChildId).toBe(EMMA.id);
  });

  it('clears the child selection as well as the auth state on confirm', async () => {
    await renderWithChildren([EMMA]);
    await click('Sign out');
    await confirmAlert(alertSpy, 'Sign Out');

    const auth = useAuthStore.getState();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.userId).toBeNull();
    expect(auth.familyId).toBeNull();
    // The load-bearing half. A stale selectedChildId survives sign-out in
    // MMKV and points at the *previous* family's child.
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('resets isOnboarded so the next person re-runs onboarding', async () => {
    await renderWithChildren([EMMA]);
    expect(useAuthStore.getState().isOnboarded).toBe(true);

    await click('Sign out');
    await confirmAlert(alertSpy, 'Sign Out');

    // Every screen gate reads `!isAuthenticated || !isOnboarded`; leaving this
    // true would still redirect today, but a future surface gating on
    // isOnboarded alone would silently skip the add-child step.
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });
});

/**
 * Rename a child in place, from the Settings → Family card.
 *
 * `children.name` was the last permanent-or-destructive field in the app.
 * Foods became renameable in v0.5.145 and every field on an exposure became
 * correctable across v0.5.167–v0.5.171, but a mistyped child name could only
 * be "fixed" by Delete Child, which cascades away every exposure that child
 * has ever logged — the exact history the 15/20/30 acceptance threshold is
 * counted from. The name is also what every child-facing surface renders:
 * the dashboard's ChildSelector, this card, and the therapist-facing CSV's
 * filename slug.
 */
describe('SettingsScreen — Rename Child', () => {
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

  function nameInput() {
    return screen.getByLabelText("Child's name") as HTMLInputElement;
  }

  async function typeName(value: string) {
    await act(async () => {
      fireEvent.change(nameInput(), { target: { value } });
    });
  }

  it('opens an editor seeded with the stored name, per child', async () => {
    await renderWithChildren([EMMA, NOAH]);
    expect(screen.getByLabelText('Rename Emma')).toBeTruthy();
    expect(screen.getByLabelText('Rename Noah')).toBeTruthy();
    // Closed until asked for.
    expect(screen.queryByLabelText("Child's name")).toBeNull();

    await click('Rename Emma');
    expect(nameInput().value).toBe('Emma');
    // Only the row that was opened.
    expect(screen.getByLabelText('Delete Noah')).toBeTruthy();
  });

  it('persists the trimmed name scoped to that child and closes', async () => {
    await renderWithChildren([EMMA, NOAH]);
    await click('Rename Emma');
    await typeName('  Emmaline  ');
    await click('Save name for Emma');

    expect(mockDb.writes).toHaveLength(1);
    const write = mockDb.writes[0];
    expect(write.kind).toBe('update');
    // The schema trims; a stored "  Emmaline  " would render with the padding
    // on every surface and slug oddly into the CSV filename.
    expect((write as { values: unknown }).values).toEqual({ name: 'Emmaline' });
    // Scoped to the row the user named — not the family, not the selection.
    expect((write as { where: unknown }).where).toEqual(eq(schema.children.id, EMMA.id));

    // The local patch follows, so the card does not need a reload to be right.
    await waitFor(() => expect(screen.getByText(/Emmaline/)).toBeTruthy());
    expect(screen.queryByLabelText("Child's name")).toBeNull();
    // The sibling row is untouched.
    expect(screen.getByText(/Noah/)).toBeTruthy();
  });

  it('rejects a whitespace-only name through the schema and writes nothing', async () => {
    await renderWithChildren([EMMA]);
    await click('Rename Emma');
    await typeName('   ');
    await click('Save name for Emma');

    expect(mockDb.writes).toHaveLength(0);
    expect(alertSpy.mock.calls[0][0]).toBe('Invalid Name');
    // Left open so the name can be corrected in place rather than retyped.
    expect(nameInput()).toBeTruthy();
  });

  it('treats a draft equal to the stored name after trimming as a no-op', async () => {
    await renderWithChildren([EMMA]);
    await click('Rename Emma');
    await typeName('  Emma  ');
    await click('Save name for Emma');

    expect(mockDb.writes).toHaveLength(0);
    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText("Child's name")).toBeNull());
  });

  it('abandons the draft on cancel and reseeds from the stored name', async () => {
    await renderWithChildren([EMMA]);
    await click('Rename Emma');
    await typeName('Discarded');
    await click('Cancel renaming Emma');

    expect(mockDb.writes).toHaveLength(0);
    expect(screen.queryByLabelText("Child's name")).toBeNull();
    expect(screen.getByText(/Emma/)).toBeTruthy();

    await click('Rename Emma');
    expect(nameInput().value).toBe('Emma');
  });

  it('alerts and stays retryable when the write fails', async () => {
    await renderWithChildren([EMMA]);
    await click('Rename Emma');
    await typeName('Emmaline');

    // failReads() only covers reads; this screen's rename issues none.
    const dbRef = mockDb.db as { update: (...a: unknown[]) => unknown };
    const realUpdate = dbRef.update;
    let failed = false;
    dbRef.update = (...args: unknown[]) => {
      if (!failed) {
        failed = true;
        return {
          set: () => ({ where: () => Promise.reject(new Error('write failed')) }),
        };
      }
      return realUpdate(...args);
    };

    await click('Save name for Emma');
    await waitFor(() =>
      expect(alertSpy.mock.calls.some((c) => c[0] === 'Error')).toBe(true)
    );
    // Not optimistic, and left open with the draft intact so the retry is
    // one tap rather than a re-open and a retype.
    expect(mockDb.writes).toHaveLength(0);
    expect(nameInput().value).toBe('Emmaline');
    // The latch was released in `finally`, so the retry goes through.
    await click('Save name for Emma');
    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    expect((mockDb.writes[0] as { values: unknown }).values).toEqual({ name: 'Emmaline' });
  });
});

/**
 * v0.5.178 — `children.dateOfBirth` and `notes` have been captured since
 * v0.1.0 and read back by no surface in the app (NEXT_STEPS gap #-1.5, the
 * same write-only defect v0.5.161 closed for a food's default preparation).
 * The Family card is the first place a parent sees what they typed.
 */
describe('SettingsScreen — child date of birth and notes (v0.5.178)', () => {
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

  /**
   * Derived from the wall clock rather than a literal, so the assertion does
   * not silently start describing a different age as the year turns over —
   * the trap NEXT_STEPS gap #-1(c) records for the date fixtures.
   */
  function isoMonthsAgo(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  it('shows a toddler age in whole months beside the name', async () => {
    await renderWithChildren([{ ...EMMA, dateOfBirth: isoMonthsAgo(9) }]);
    expect(screen.getByText('Emma', { exact: false })).toBeTruthy();
    expect(screen.getByText('9 months')).toBeTruthy();
  });

  it('shows years and months once the child is over two', async () => {
    await renderWithChildren([{ ...EMMA, dateOfBirth: isoMonthsAgo(28) }]);
    expect(screen.getByText('2y 4m')).toBeTruthy();
  });

  it('shows the notes a parent recorded on the add screen', async () => {
    await renderWithChildren([{ ...EMMA, notes: 'Gags on purees' }]);
    expect(screen.getByText('Gags on purees')).toBeTruthy();
  });

  it('renders each child against its own row rather than the first one', async () => {
    await renderWithChildren([
      { ...EMMA, dateOfBirth: isoMonthsAgo(9), notes: 'Gags on purees' },
      { ...NOAH, dateOfBirth: isoMonthsAgo(28), notes: 'Loves crunchy food' },
    ]);
    expect(screen.getByText('9 months')).toBeTruthy();
    expect(screen.getByText('2y 4m')).toBeTruthy();
    expect(screen.getByText('Gags on purees')).toBeTruthy();
    expect(screen.getByText('Loves crunchy food')).toBeTruthy();
  });

  it('collapses both lines when neither was recorded', async () => {
    // The common case — both fields are optional on the add path — so the row
    // must not grow an empty line or a placeholder.
    await renderWithChildren([EMMA]);
    expect(screen.getByLabelText('Delete Emma')).toBeTruthy();
    expect(screen.queryByText('Newborn')).toBeNull();
    expect(screen.queryByText('0 months')).toBeNull();
  });

  it('shows nothing rather than a negative age for a malformed or future date', async () => {
    // The column has no format constraint, so a legacy or synced row can hold
    // one even though `childSchema` rejects it on the add path.
    await renderWithChildren([
      { ...EMMA, dateOfBirth: '12/05/2020' },
      { ...NOAH, dateOfBirth: '2099-01-01' },
    ]);
    expect(screen.getByLabelText('Delete Emma')).toBeTruthy();
    expect(screen.getByLabelText('Delete Noah')).toBeTruthy();
    expect(screen.queryByText('12/05/2020')).toBeNull();
    expect(screen.queryByText(/^-/)).toBeNull();
  });
});
