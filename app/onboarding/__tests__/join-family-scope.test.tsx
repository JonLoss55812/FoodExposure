/**
 * Join Family against **real SQL**: which family a code opens, and which
 * family the duplicate-name check (v0.5.91) looks in.
 *
 * `join.test.tsx` serves canned rows from `createMockDb`, which never
 * evaluates a `where` — so it cannot tell a lookup scoped to the typed code
 * from one that returns the first family on the device, nor a name check
 * scoped to the family being joined from one that spans every family. Both
 * mistakes are invisible on a single-family device and wrong on a shared one:
 * the first signs the parent into somebody else's family (and every read
 * after that is scoped to it); the second blocks "Anne" from joining her own
 * family because an unrelated family on the phone also has an Anne.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import JoinFamilyScreen from '../join';
import { useAuthStore } from '@/src/stores/auth-store';

// seedTwoFamilies: f1 uses ABCDEF, f2 uses GHJKLM.
function join(name: string, code: string) {
  render(<JoinFamilyScreen />);
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByLabelText('Join Family'));
}

const usersIn = (familyId: string) =>
  mockSqlite.raw
    .prepare('SELECT email FROM users WHERE family_id = ? ORDER BY email')
    .all(familyId)
    .map((r) => (r as { email: string }).email);

describe('JoinFamilyScreen family scoping (real SQL)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSqlite = createSqliteDb();
    seedTwoFamilies(mockSqlite.raw);
    // An "Anne" already belongs to family f1.
    mockSqlite.raw.exec(`
      INSERT INTO users (id, family_id, email, display_name, created_at) VALUES
        ('u-anne', 'f1', 'anne@tonguetutor.app', 'Anne', 1);
    `);
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useAuthStore.getState().logout();
  });

  it("joins the family the code names, even when another family has a member of the same name", async () => {
    join('Anne', 'GHJKLM');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().familyId).toBe('f2');
    expect(usersIn('f2')).toEqual(['anne@tonguetutor.app']);
    // f1's Anne is untouched and f1 gained no member.
    expect(usersIn('f1')).toEqual(['a@x.app', 'anne@tonguetutor.app']);
  });

  it('blocks a second member of the same name in the same family', async () => {
    join('Anne', 'ABCDEF');

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Name Already Taken');
    expect(usersIn('f1')).toEqual(['a@x.app', 'anne@tonguetutor.app']);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('lets a differently named member join a family that already has members', async () => {
    join('Bea', 'ABCDEF');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().familyId).toBe('f1');
    expect(usersIn('f1')).toEqual(['a@x.app', 'anne@tonguetutor.app', 'bea@tonguetutor.app']);
  });
});
