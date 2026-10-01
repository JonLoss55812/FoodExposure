/**
 * Pins the per-screen `ErrorBoundary` exports (v0.5.189).
 *
 * expo-router wraps a route's *own component* in its boundary
 * (`useScreens.fromImport` -> `<Try catch={ErrorBoundary}>`), so the boundary
 * a route exports decides how much of the app a render error takes down. The
 * root layout's boundary replaces the whole navigator — tab bar and modal
 * dismiss gesture included — leaving "Try again" as the only way out. A
 * boundary exported from the screen itself keeps the navigator mounted: a
 * crash in Progress still leaves the tab bar to reach Log, and a crash in a
 * food/child modal can still be swiped away.
 *
 * Like the root, expo-router finds these by export name alone, so a deleted
 * line fails silently at runtime; this is the only thing that notices.
 *
 * Onboarding is deliberately absent: it disables the back gesture and has no
 * tab bar, so a screen boundary would offer nothing the root one does not.
 */
jest.mock('@/src/db/client', () => ({ db: {}, expoDb: {} }));

import { RouteErrorBoundary } from '@/src/components/RouteErrorBoundary';

const SCREENS: Record<string, () => Record<string, unknown>> = {
  '(tabs)/index': () => require('../(tabs)/index'),
  '(tabs)/foods': () => require('../(tabs)/foods'),
  '(tabs)/log': () => require('../(tabs)/log'),
  '(tabs)/progress': () => require('../(tabs)/progress'),
  '(tabs)/settings': () => require('../(tabs)/settings'),
  'food/add': () => require('../food/add'),
  'food/[id]': () => require('../food/[id]'),
  'child/add': () => require('../child/add'),
  'child/[id]': () => require('../child/[id]'),
};

describe('per-screen ErrorBoundary exports', () => {
  it.each(Object.keys(SCREENS))('%s exports the shared RouteErrorBoundary', (name) => {
    const mod = SCREENS[name]();
    // Guard against a vacuous pass: the module must be the real screen.
    expect(typeof mod.default).toBe('function');
    expect(mod.ErrorBoundary).toBe(RouteErrorBoundary);
  });
});
