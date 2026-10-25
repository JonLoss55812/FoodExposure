/**
 * The child selection belongs to one family. `login()` and `setFamilyId()`
 * are the only ways the signed-in family changes, so they are where a
 * selection naming another family's child is dropped — once, at the source,
 * instead of in every screen that reads `selectedChildId` (critique
 * 2026-10-23 #2). Covers both routes the critique named: a deep link that
 * logs in over a live session, and MMKV partial corruption where the auth
 * store resets but the child store survives.
 */
import { useAuthStore } from '../auth-store';
import { useChildStore } from '../child-store';

const SESSION = (familyId: string) => ({
  userId: `u-${familyId}`,
  familyId,
  email: `${familyId}@tonguetutor.app`,
  displayName: 'Parent',
});

beforeEach(() => {
  useAuthStore.getState().logout();
  useChildStore.getState().clear();
});

describe('the child selection follows the signed-in family', () => {
  it('logging in to another family drops the previous family\'s selection', () => {
    useAuthStore.getState().login(SESSION('fam-a'));
    useChildStore.getState().selectChild('child-of-a');

    useAuthStore.getState().login(SESSION('fam-b'));

    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('a surviving selection is dropped when auth was reset underneath it', () => {
    // MMKV partial corruption: the auth blob is gone, the child blob is not.
    useChildStore.getState().selectChild('child-of-a');
    expect(useAuthStore.getState().familyId).toBeNull();

    useAuthStore.getState().login(SESSION('fam-b'));

    expect(useChildStore.getState().selectedChildId).toBeNull();
  });

  it('logging in again to the same family keeps the selection', () => {
    useAuthStore.getState().login(SESSION('fam-a'));
    useChildStore.getState().selectChild('child-of-a');

    useAuthStore.getState().login(SESSION('fam-a'));

    expect(useChildStore.getState().selectedChildId).toBe('child-of-a');
  });

  it('setFamilyId to another family drops the selection; to the same one keeps it', () => {
    useAuthStore.getState().login(SESSION('fam-a'));
    useChildStore.getState().selectChild('child-of-a');

    useAuthStore.getState().setFamilyId('fam-a');
    expect(useChildStore.getState().selectedChildId).toBe('child-of-a');

    useAuthStore.getState().setFamilyId('fam-b');
    expect(useChildStore.getState().selectedChildId).toBeNull();
  });
});
