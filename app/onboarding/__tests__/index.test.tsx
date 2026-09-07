/**
 * Screen coverage for `app/onboarding/index.tsx` — the app's first write path.
 *
 * This handler creates the two rows every other row in the database is scoped
 * to: the `families` row that owns every child/food, and the `users` row that
 * becomes the signed-in identity. Two things here are load-bearing and were
 * shipping unverified:
 *
 *  1. The `familyId` written on the user row must be the *same* id written on
 *     the family row. If the two drift, the insert still succeeds and the app
 *     still navigates — but every family-scoped read from that point on
 *     (`eq(foods.familyId, familyId)`, the Foods tab, the children list)
 *     matches nothing, so the parent lands in a permanently empty app with no
 *     error anywhere. The same id also has to reach the auth store, which is
 *     what the rest of the app actually reads.
 *
 *  2. A failed insert must leave the auth store *signed out*. A half-onboarded
 *     state — authenticated against a family row that was never written — is
 *     worse than the failure itself: the redirect guards in `(tabs)/_layout`
 *     let the parent into the app, where every read is scoped to a
 *     nonexistent family.
 *
 * Seams are the established ones (mock-prefixed router spy, getter-based db
 * mock, `Alert.alert` spy, real zustand stores reset via `logout()`); no
 * `SafeAreaProvider` is needed — this screen is a plain `View`.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { click } from '@/src/test-utils/screen-helpers';
import { isValidInviteCode } from '@/src/lib/utils';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import OnboardingScreen from '../index';
import { useAuthStore } from '@/src/stores/auth-store';

/** The two inserts, in the order the handler issues them. */
function insertedValues() {
  return mockDb.writes.map((w) => (w as { values: Record<string, unknown> }).values);
}

const tapGetStarted = () => click('Get Started');

describe('OnboardingScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders the primary action and the join-with-a-code alternative', () => {
    render(<OnboardingScreen />);
    expect(screen.getByLabelText('Get Started')).toBeTruthy();
    expect(screen.getByLabelText('Have an invite code? Join your family')).toBeTruthy();
  });

  it('routes to the join flow without creating a family', async () => {
    render(<OnboardingScreen />);
    await click('Have an invite code? Join your family');

    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/join');
    expect(mockDb.writes).toHaveLength(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('creates the family then the user, scoping the user to that family', async () => {
    render(<OnboardingScreen />);
    await tapGetStarted();

    await waitFor(() => expect(mockDb.writes).toHaveLength(2));
    const [family, user] = insertedValues();

    // Dependents-last: the family row must exist before the user that
    // references it, so a mid-sequence failure never orphans the user.
    expect(family).toEqual(
      expect.objectContaining({ name: 'My Family', inviteCode: expect.any(String) }),
    );
    expect(user).toEqual(
      expect.objectContaining({
        email: 'local@tonguetutor.app',
        displayName: 'Parent',
      }),
    );

    // The load-bearing assertion: the user is scoped to the family that was
    // just written, not to some other generated id.
    expect(user.familyId).toBe(family.id);
    expect(user.id).not.toBe(family.id);
  });

  it('generates an invite code the Join Family flow can actually accept', async () => {
    render(<OnboardingScreen />);
    await tapGetStarted();
    await waitFor(() => expect(mockDb.writes).toHaveLength(2));

    // `join.tsx` validates a typed code through `isValidInviteCode` before it
    // will even run the lookup — so a code this screen persists outside that
    // charset would be silently un-joinable by the second parent, with the
    // misleading "No family found" as the only symptom.
    expect(isValidInviteCode(insertedValues()[0].inviteCode as string)).toBe(true);
  });

  it('signs in with the persisted ids and moves on to add a child', async () => {
    render(<OnboardingScreen />);
    await tapGetStarted();

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/add-child'));
    const [family, user] = insertedValues();
    const auth = useAuthStore.getState();

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.userId).toBe(user.id);
    expect(auth.familyId).toBe(family.id);
    expect(auth.displayName).toBe('Parent');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('leaves the parent signed out and on this screen when the write fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let failNext = true;
    (mockDb.db as { insert: unknown }).insert = () => ({
      values: (values: unknown) => {
        if (failNext) return Promise.reject(new Error('insert failed'));
        mockDb.writes.push({ kind: 'insert', values });
        return Promise.resolve();
      },
    });

    render(<OnboardingScreen />);
    await tapGetStarted();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    // Never half-onboarded: an authenticated session pointed at a family row
    // that was never written would let the parent past the tab-layout guard
    // into an app where every scoped read matches nothing.
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().familyId).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();

    // The latch is released in the catch, so the retry gets through rather
    // than being stranded by the first failure.
    failNext = false;
    await tapGetStarted();
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/add-child');
  });

  it('reports in-flight work on the button so a second tap is not invited', async () => {
    render(<OnboardingScreen />);
    const button = screen.getByLabelText('Get Started');
    expect(button.getAttribute('aria-busy')).not.toBe('true');

    await tapGetStarted();
    // Success keeps `saving` true through the navigation — the button must
    // not flip back to idle on a screen that is about to unmount.
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});
