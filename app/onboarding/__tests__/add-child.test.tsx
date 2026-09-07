/**
 * Screen coverage for `app/onboarding/add-child.tsx` — the last leg of the
 * first-launch flow and the other screen that was at 0%.
 *
 * It is close to `app/child/add.tsx` (already covered) but carries two
 * things that screen does not, and both are the kind that fail silently:
 *
 *  1. `setOnboarded(true)`. That flag is what ends onboarding — `(tabs)/_layout`
 *     and the dashboard both redirect on `!isOnboarded`. If it does not fire,
 *     the child row is written and the parent is bounced straight back to
 *     this screen, forever, with no error. Adding the child again just writes
 *     a duplicate. It is one line, and nothing pinned it.
 *
 *  2. `router.replace`, not `push`. A back gesture that returns a
 *     newly-onboarded parent to "Add Your Child" invites a second child row
 *     for the same kid, which then splits the exposure history the acceptance
 *     threshold is counted from across two children.
 *
 * Plus the same seams as its sibling: the `familyId` guard, the selection
 * repair, and a failure path that has to stay retryable.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { click } from '@/src/test-utils/screen-helpers';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import AddChildOnboardingScreen from '../add-child';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const tapStart = () => click('Start Tracking');

function insertedValues() {
  return (mockDb.writes[0] as { values: Record<string, unknown> }).values;
}

/** Put the store in the state this screen is always reached in. */
function signIn() {
  useAuthStore.getState().login({
    userId: 'user-1',
    familyId: 'fam-1',
    email: 'local@tonguetutor.app',
    displayName: 'Parent',
  });
}

describe('AddChildOnboardingScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
    signIn();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders the avatar grid, the name field and the submit action', () => {
    render(<AddChildOnboardingScreen />);
    expect(screen.getByLabelText('Avatar: 👶')).toBeTruthy();
    expect(screen.getByLabelText("Child's name")).toBeTruthy();
    expect(screen.getByLabelText('Start Tracking')).toBeTruthy();
  });

  it('rejects a whitespace-only name without touching the database', async () => {
    render(<AddChildOnboardingScreen />);
    type("Child's name", '   ');
    await tapStart();

    await waitFor(() => expect(screen.getByText('Name is required')).toBeTruthy());
    expect(mockDb.writes).toHaveLength(0);
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });

  it('rejects a US-style date without persisting a garbage string', async () => {
    render(<AddChildOnboardingScreen />);
    type("Child's name", 'Emma');
    // The schema owns the message; what has to be true of the screen is that
    // a rejection issues zero writes — `dateOfBirth` is a field most parents
    // never revisit after onboarding, so a bad value persists forever.
    type('Date of birth (optional)', '12/05/2020');
    await tapStart();

    await waitFor(() => expect(alertSpy).not.toHaveBeenCalled());
    expect(mockDb.writes).toHaveLength(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('persists a family-scoped, trimmed child with the untouched optionals as null', async () => {
    render(<AddChildOnboardingScreen />);
    type("Child's name", '  Emma  ');
    await tapStart();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    expect(insertedValues()).toEqual(
      expect.objectContaining({
        familyId: 'fam-1',
        name: 'Emma',
        avatarEmoji: '👶',
        // Absent optionals must round-trip as absent, not as ''.
        dateOfBirth: null,
        notes: null,
      }),
    );
  });

  it('persists a chosen avatar over the default', async () => {
    render(<AddChildOnboardingScreen />);
    await click('Avatar: 🦋');
    type("Child's name", 'Emma');
    await tapStart();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    expect(insertedValues().avatarEmoji).toBe('🦋');
  });

  it('ends onboarding, selects the new child, and replaces into the app', async () => {
    render(<AddChildOnboardingScreen />);
    type("Child's name", 'Emma');
    await tapStart();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    // Without setOnboarded the parent is redirected straight back here by the
    // tab layout — child written, app unreachable, no error shown.
    expect(useAuthStore.getState().isOnboarded).toBe(true);
    // Every child-scoped read keys off the store's selectedChildId, so the
    // first child has to become the selection here.
    expect(useChildStore.getState().selectedChildId).toBe(insertedValues().id);
    // `replace`, not `push`: a back gesture must not return to this form and
    // invite a duplicate child row for the same kid.
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('writes nothing and stays in onboarding when no family is signed in', async () => {
    useAuthStore.getState().logout();
    render(<AddChildOnboardingScreen />);
    type("Child's name", 'Emma');
    await tapStart();

    await act(async () => {});
    expect(mockDb.writes).toHaveLength(0);
    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(useChildStore.getState().selectedChildId).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('alerts on a failed insert, stays in onboarding, and stays retryable', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let failNext = true;
    (mockDb.db as { insert: unknown }).insert = () => ({
      values: (values: unknown) => {
        if (failNext) return Promise.reject(new Error('insert failed'));
        mockDb.writes.push({ kind: 'insert', values });
        return Promise.resolve();
      },
    });

    render(<AddChildOnboardingScreen />);
    type("Child's name", 'Emma');
    await tapStart();

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to add child')),
    );
    expect(useAuthStore.getState().isOnboarded).toBe(false);
    expect(useChildStore.getState().selectedChildId).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    // The latch is released in `finally`, so the retry gets through.
    failNext = false;
    await tapStart();
    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    expect(useAuthStore.getState().isOnboarded).toBe(true);
    errorSpy.mockRestore();
  });
});
