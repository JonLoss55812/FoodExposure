/**
 * Screen tests for `app/child/add.tsx` — NEXT_STEPS gap #1's last named target
 * ("the last uncovered screen with real logic").
 *
 * Two things here have shipped screen-level and therefore unverified.
 *
 * (1) `selectChild(childId)` after the insert. Every child-scoped read in the
 *     app is keyed off the store's `selectedChildId`; a parent who adds their
 *     second child and is not switched to them would log the next exposure
 *     against the *first* child, silently, with no on-screen cue. That call is
 *     one line and easy to lose in a refactor.
 * (2) The schema-owned rejections. `childSchema` validates the name and three
 *     separate `dateOfBirth` refinements (format v0.5.79, future v0.5.87,
 *     implausibly-old v0.5.100). The schema owns those, so what has to be true
 *     of the *screen* is that a rejection issues **zero writes** — a persisted
 *     `dateOfBirth: '12/05/2020'` is a permanent garbage string in a field most
 *     parents never revisit.
 *
 * Seams per NEXT_STEPS gap #1: mock-prefixed router variable, getter-based db
 * mock, `getByLabelText` + `fireEvent.change`. No `SafeAreaProvider` is needed
 * — this screen is a plain `ScrollView`.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

import AddChildScreen from '../add';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function tapAdd() {
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Add Child'));
  });
}

/** The single `insert` this screen issues, as the values it persisted. */
function insertedValues() {
  const inserts = mockDb.writes.filter((w) => w.kind === 'insert');
  expect(inserts).toHaveLength(1);
  return (inserts[0] as { kind: 'insert'; values: Record<string, unknown> }).values;
}

describe('AddChildScreen', () => {
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
    useChildStore.getState().clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the avatar grid, the name field and the submit action', () => {
    render(<AddChildScreen />);
    expect(screen.getByLabelText("Child's name")).toBeTruthy();
    expect(screen.getByLabelText('Avatar: 👶')).toBeTruthy();
    expect(screen.getByLabelText('Avatar: 🦋')).toBeTruthy();
    expect(screen.getByLabelText('Add Child')).toBeTruthy();
  });

  it('rejects a whitespace-only name through the schema and writes nothing', async () => {
    render(<AddChildScreen />);
    type("Child's name", '   ');
    await tapAdd();

    // `childSchema.name` is `.trim().min(1)` (v0.5.75) — the rejection belongs
    // to the schema, so the screen must not reach the database at all.
    await waitFor(() => expect(screen.getByText('Name is required')).toBeTruthy());
    expect(mockDb.writes).toHaveLength(0);
  });

  it('rejects a US-style date of birth and writes nothing', async () => {
    render(<AddChildScreen />);
    type("Child's name", 'Emma');
    type('Date of birth (optional)', '12/05/2020');
    await tapAdd();

    // v0.5.79: a free-form or US-style date must not persist verbatim.
    await waitFor(() =>
      expect(screen.getByText('Date of birth must be a valid YYYY-MM-DD date')).toBeTruthy()
    );
    expect(mockDb.writes).toHaveLength(0);
  });

  it('rejects a future date of birth and writes nothing', async () => {
    render(<AddChildScreen />);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    type("Child's name", 'Emma');
    type('Date of birth (optional)', tomorrow);
    await tapAdd();

    // v0.5.87 — the off-by-a-year fat-finger, which would render a negative age.
    await waitFor(() =>
      expect(screen.getByText('Date of birth cannot be in the future')).toBeTruthy()
    );
    expect(mockDb.writes).toHaveLength(0);
  });

  it('persists a family-scoped row with the trimmed name and null optionals', async () => {
    render(<AddChildScreen />);
    type("Child's name", '  Emma  ');
    await tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const values = insertedValues();
    expect(values.familyId).toBe('fam-1');
    expect(values.name).toBe('Emma');
    expect(values.avatarEmoji).toBe('👶');
    // `dateOfBirth`/`notes` are `.optional()` in the schema and nullable in
    // SQLite, so "not recorded" has to round-trip as absent, not as ''.
    expect(values.dateOfBirth).toBeNull();
    expect(values.notes).toBeNull();
    expect(typeof values.id).toBe('string');
  });

  it('selects the newly created child so the app switches to them', async () => {
    render(<AddChildScreen />);
    type("Child's name", 'Emma');
    await tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    // The load-bearing case: without this, a parent adding their second child
    // keeps logging exposures against the first one, silently.
    expect(useChildStore.getState().selectedChildId).toBe(insertedValues().id);
  });

  it('persists the chosen avatar and the filled optional fields', async () => {
    render(<AddChildScreen />);
    type("Child's name", 'Emma');
    type('Date of birth (optional)', '2020-01-15');
    type('Notes (optional)', '  Peanut allergy  ');
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Avatar: 👧'));
    });
    await tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const values = insertedValues();
    expect(values.avatarEmoji).toBe('👧');
    expect(values.dateOfBirth).toBe('2020-01-15');
    expect(values.notes).toBe('Peanut allergy');
  });

  it('routes back when the success Alert is acknowledged', async () => {
    render(<AddChildScreen />);
    type("Child's name", 'Emma');
    await tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][1]).toContain('Emma');
    expect(mockRouter.back).not.toHaveBeenCalled();
    await pressAlertButton(alertSpy, 'OK');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('writes nothing when no family is signed in', async () => {
    useAuthStore.getState().logout();
    render(<AddChildScreen />);
    type("Child's name", 'Emma');
    await tapAdd();

    // A `familyId`-less child row is invisible to every family-scoped read.
    await waitFor(() => expect(mockDb.writes).toHaveLength(0));
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('alerts on a failed insert, leaves the selection alone, and stays retryable', async () => {
    let failNext = true;
    (mockDb.db as { insert: unknown }).insert = () => ({
      values: (values: unknown) => {
        if (failNext) return Promise.reject(new Error('insert failed'));
        mockDb.writes.push({ kind: 'insert', values });
        return Promise.resolve();
      },
    });

    render(<AddChildScreen />);
    type("Child's name", 'Emma');
    await tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to add child')));
    expect(useChildStore.getState().selectedChildId).toBeNull();
    expect(mockRouter.back).not.toHaveBeenCalled();

    // The v0.5.144 latch is released in `finally`, so the retry gets through
    // rather than being stranded by the first failure.
    failNext = false;
    await tapAdd();
    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    expect(useChildStore.getState().selectedChildId).toBe(insertedValues().id);
  });
});
