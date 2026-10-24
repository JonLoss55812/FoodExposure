import { resolveOnboardingEntryRedirect } from '../onboarding-entry';

describe('resolveOnboardingEntryRedirect', () => {
  it('shows the screen to a signed-out parent', () => {
    expect(resolveOnboardingEntryRedirect({ isAuthenticated: false, isOnboarded: false })).toBeNull();
  });

  it('ignores a stale onboarded flag without a session', () => {
    expect(resolveOnboardingEntryRedirect({ isAuthenticated: false, isOnboarded: true })).toBeNull();
  });

  it('sends an onboarded parent to the tabs', () => {
    expect(resolveOnboardingEntryRedirect({ isAuthenticated: true, isOnboarded: true })).toBe('/(tabs)');
  });

  it('sends a signed-in parent with no child yet to Add Child', () => {
    expect(resolveOnboardingEntryRedirect({ isAuthenticated: true, isOnboarded: false })).toBe(
      '/onboarding/add-child'
    );
  });
});
