/**
 * Pins the root layout's `ErrorBoundary` export. expo-router discovers the
 * boundary by that export name alone, so deleting or renaming the line fails
 * silently at runtime — the app just loses its recovery screen.
 */
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

import * as RootLayoutModule from '../_layout';
import { RouteErrorBoundary } from '@/src/components/RouteErrorBoundary';

describe('app/_layout', () => {
  it('exports the shared RouteErrorBoundary as the root ErrorBoundary', () => {
    expect((RootLayoutModule as Record<string, unknown>).ErrorBoundary).toBe(RouteErrorBoundary);
  });
});
