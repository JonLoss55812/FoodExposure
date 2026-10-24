/**
 * Onboarding as a **flow across screens**, with the real stores and real SQL.
 *
 * Every other onboarding suite renders one screen and asserts what it wrote
 * and where it navigated. That missed v0.5.227 for ~146 versions: Join Family
 * navigated to the tabs correctly, but never marked the parent onboarded, so
 * the *next* screen — the dashboard — sent them straight back to the welcome
 * screen. Only a test that carries the stores from one screen into the next
 * can see that kind of hand-off bug.
 *
 * Navigation is a spy, so each step renders the screen the previous step
 * navigated to and checks the spy agreed. The persisted state (auth store,
 * child store, SQLite) is the real thing and flows between steps untouched.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { Alert } from 'react-native';
import { createSqliteDb } from '@/src/test-utils/sqlite-db';
import { SafeArea, click } from '@/src/test-utils/screen-helpers';

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

import OnboardingScreen from '../index';
import AddChildOnboardingScreen from '../add-child';
import JoinFamilyScreen from '../join';
import DashboardScreen from '../../(tabs)/index';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const count = (table: string) =>
  (mockSqlite.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

/** Unmount the current screen and forget where it navigated. */
function leaveScreen() {
  cleanup();
  jest.clearAllMocks();
}

async function getStarted() {
  render(<OnboardingScreen />);
  await click('Get Started');
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/add-child'));
  leaveScreen();
}

async function addFirstChild(name: string) {
  render(<AddChildOnboardingScreen />);
  fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: name } });
  await click('Start Tracking');
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
  leaveScreen();
}

async function openDashboard() {
  await act(async () => {
    render(
      <SafeArea>
        <DashboardScreen />
      </SafeArea>
    );
  });
}

describe('onboarding flow across screens (real stores, real SQL)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockSqlite = createSqliteDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAuthStore.getState().logout();
    useChildStore.getState().clear();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('create family -> add child -> the dashboard keeps the parent and shows the child', async () => {
    await getStarted();
    await addFirstChild('Emma');

    await openDashboard();

    await waitFor(() => expect(screen.getByLabelText('Select Emma')).toBeTruthy());
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/onboarding');
    expect(useChildStore.getState().selectedChildId).not.toBeNull();
  });

  it('sign out -> join with the invite code -> the dashboard keeps the joiner in that family', async () => {
    await getStarted();
    await addFirstChild('Emma');
    const familyId = useAuthStore.getState().familyId;
    const { invite_code: code } = mockSqlite.raw
      .prepare('SELECT invite_code FROM families')
      .get() as { invite_code: string };

    // What Settings -> Sign Out does.
    useChildStore.getState().clear();
    useAuthStore.getState().logout();

    render(<JoinFamilyScreen />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Anne' } });
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
    await click('Join Family');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    leaveScreen();

    await openDashboard();

    await waitFor(() => expect(screen.getByLabelText('Select Emma')).toBeTruthy());
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/onboarding');
    expect(useAuthStore.getState().familyId).toBe(familyId);
    expect(count('families')).toBe(1);
  });

  it('a parent who quit before adding a child resumes at Add Child, not a second family', async () => {
    await getStarted();
    expect(count('families')).toBe(1);

    // Relaunch: the dashboard bounces the not-yet-onboarded parent to /onboarding ...
    await openDashboard();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding'));
    leaveScreen();

    // ... which forwards them on to finish the family they already have.
    render(<OnboardingScreen />);
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/add-child')
    );
    expect(screen.queryByLabelText('Get Started')).toBeNull();
    leaveScreen();

    await addFirstChild('Emma');
    expect(count('families')).toBe(1);
    expect(count('children')).toBe(1);
  });
});
