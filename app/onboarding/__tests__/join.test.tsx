/**
 * First screen-level render test in the codebase (NEXT_STEPS gap #1).
 *
 * Every `app/` screen previously shipped untested because there was no jest
 * harness for expo-router + drizzle + zustand/MMKV screens; dozens of
 * changelog entries cite the resulting "ship-without-test pattern". This
 * file establishes the seams so the pattern can be copied to other screens:
 *
 *   - `expo-router`      -> jest.mock with a shared router spy object
 *   - `@/src/db/client`  -> jest.mock returning `createMockDb().db`
 *   - `Alert.alert`      -> jest.spyOn, so alert copy is assertable
 *   - stores             -> real zustand stores, reset between tests
 *
 * `app/onboarding/join.tsx` is the target because it is the screen with the
 * most load-bearing untested logic: the v0.5.91 duplicate-name pre-check,
 * the v0.5.88 invite-code charset guard, and the v0.5.144 in-flight latch
 * that keeps a double-tap from creating two `users` rows.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import JoinFamilyScreen from '../join';
import { useAuthStore } from '@/src/stores/auth-store';

const FAMILY = { id: 'fam-1', name: 'Loss', inviteCode: 'ABC234' };

function fillForm({ name = 'Anne', code = 'ABC234' } = {}) {
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
}

function tapJoin() {
  fireEvent.click(screen.getByLabelText('Join Family'));
}

describe('JoinFamilyScreen', () => {
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

  it('renders both fields and the join action', () => {
    render(<JoinFamilyScreen />);
    expect(screen.getByLabelText('Your name')).toBeTruthy();
    expect(screen.getByLabelText('Invite code')).toBeTruthy();
    expect(screen.getByLabelText('Join Family')).toBeTruthy();
  });

  it('blocks submission with a missing field and never touches the database', async () => {
    render(<JoinFamilyScreen />);
    fillForm({ name: '   ', code: 'ABC234' });
    tapJoin();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Missing Info');
    expect(mockDb.selectCount()).toBe(0);
    expect(mockDb.writes).toHaveLength(0);
  });

  it('rejects an invite code outside the generator charset before querying', async () => {
    render(<JoinFamilyScreen />);
    // 'O' and '0' are excluded from INVITE_CODE_CHARSET, so a real code
    // can never contain them — reporting that precisely beats the
    // misleading "No family found" the lookup would otherwise produce.
    fillForm({ code: 'ABCO23' });
    tapJoin();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Invalid Code');
    expect(mockDb.selectCount()).toBe(0);
  });

  it('surfaces a not-found alert when no family matches the code', async () => {
    mockDb.queueSelect([]);
    render(<JoinFamilyScreen />);
    fillForm();
    tapJoin();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Not Found');
    expect(mockDb.writes).toHaveLength(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('blocks a display name already used inside the family (v0.5.91 pre-check)', async () => {
    mockDb.queueSelect([FAMILY]);
    mockDb.queueSelect([{ id: 'user-existing', email: 'anne@tonguetutor.app' }]);
    render(<JoinFamilyScreen />);
    fillForm();
    tapJoin();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Name Already Taken');
    expect(mockDb.writes).toHaveLength(0);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('inserts the user, logs in, and navigates on the happy path', async () => {
    mockDb.queueSelect([FAMILY]);
    mockDb.queueSelect([]);
    render(<JoinFamilyScreen />);
    fillForm({ name: '  Anne  ' });
    tapJoin();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockDb.writes).toEqual([
      {
        kind: 'insert',
        values: expect.objectContaining({
          familyId: 'fam-1',
          email: 'anne@tonguetutor.app',
          displayName: 'Anne', // trimmed, per v0.5.76
        }),
      },
    ]);
    const auth = useAuthStore.getState();
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.familyId).toBe('fam-1');
    expect(auth.displayName).toBe('Anne');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('disables the join button while the join is in flight', async () => {
    mockDb.queueSelect([FAMILY]);
    mockDb.queueSelect([]);
    render(<JoinFamilyScreen />);
    fillForm();

    const button = screen.getByLabelText('Join Family');
    expect(button.getAttribute('aria-busy')).not.toBe('true');
    tapJoin();

    // The Button's loading state is the user-visible half of the
    // double-submit guard. Note what this harness canNOT prove: a second
    // press is never dispatched by react-native-web's Pressable once the
    // first is in flight, so no DOM-level test here can distinguish the
    // v0.5.144 synchronous latch being present from it being removed
    // (verified: both guards can be deleted and a two-tap test still sees
    // one insert). The latch's semantics stay covered by in-flight.test.ts;
    // this test pins only the busy state, which mutation-fails if the
    // Button's `loading` prop is dropped.
    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
  });

  it('reports a database failure instead of navigating', async () => {
    mockDb.failReads();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<JoinFamilyScreen />);
    fillForm();
    tapJoin();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('releases the in-flight latch after a failure so the user can retry', async () => {
    mockDb.failReads();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<JoinFamilyScreen />);
    fillForm();
    tapJoin();
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    const readsAfterFirst = mockDb.selectCount();
    tapJoin();
    await waitFor(() => expect(mockDb.selectCount()).toBeGreaterThan(readsAfterFirst));
    errorSpy.mockRestore();
  });
});
