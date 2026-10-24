/**
 * Where an onboarding entry screen (welcome, Join Family) should send a parent
 * who *arrives* there already signed in — through a deep link to the
 * `tonguetutor` scheme, a stale back stack, or the dashboard's not-onboarded
 * redirect.
 *
 * Both screens call `login()`, which replaces the signed-in family without
 * touching the persisted child selection. Offering Get Started or Join to a
 * signed-in parent therefore creates a second family over a live session (or
 * swaps families under a child id from the old one), abandoning the first.
 *
 * - onboarded -> the tabs.
 * - signed in but no child added yet -> Add Child, which finishes onboarding
 *   for the family they already have. Without this, killing the app between
 *   Get Started and Add Child relaunches onto the welcome screen, and the
 *   next Get Started orphans the first family.
 * - signed out -> null: show the screen.
 */
export type OnboardingEntryRedirect = '/(tabs)' | '/onboarding/add-child';

export function resolveOnboardingEntryRedirect(state: {
  isAuthenticated: boolean;
  isOnboarded: boolean;
}): OnboardingEntryRedirect | null {
  if (state.isAuthenticated !== true) return null;
  return state.isOnboarded === true ? '/(tabs)' : '/onboarding/add-child';
}
