import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
// expo-router's own route boundary: the component that mounts whatever a route
// exports as `ErrorBoundary`. Driving the real one, rather than a hand-rolled
// class, means these tests exercise the same catch -> fallback -> retry contract
// the app relies on.
import { Try } from 'expo-router/build/views/Try';
import { RouteErrorBoundary } from '../RouteErrorBoundary';
import { darkTheme, lightTheme } from '@/src/styles/theme';
import { rgb, setMockTheme } from '@/src/test-utils/mock-theme';

const mockCaptureException = jest.fn();

jest.mock('@/src/lib/sentry', () => ({
  Sentry: { captureException: (...args: unknown[]) => mockCaptureException(...args) },
}));

const mockCanGoBack = jest.fn(() => false);
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    canGoBack: () => mockCanGoBack(),
    back: () => mockBack(),
  },
}));

let shouldThrow = true;

function Flaky() {
  if (shouldThrow) throw new Error('boom: Failed query params: Emma, refused peas');
  return <>{'Recovered content'}</>;
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    mockCaptureException.mockClear();
    mockCanGoBack.mockReset().mockReturnValue(false);
    mockBack.mockReset();
    // React logs every caught render error; the boundary logs once more by design.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces a crashed route with a recovery screen instead of a blank one', () => {
    render(
      <Try catch={RouteErrorBoundary}>
        <Flaky />
      </Try>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByLabelText('Try again')).toBeTruthy();
    expect(screen.queryByText('Recovered content')).toBeNull();
  });

  it('does not show the raw error message, which can carry a child’s data', () => {
    render(
      <Try catch={RouteErrorBoundary}>
        <Flaky />
      </Try>
    );
    expect(screen.queryByText(/refused peas/)).toBeNull();
  });

  it('reports the caught error to Sentry exactly once', () => {
    render(
      <Try catch={RouteErrorBoundary}>
        <Flaky />
      </Try>
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((mockCaptureException.mock.calls[0][0] as Error).message).toMatch(/^boom/);
  });

  it('logs the caught error so it reaches the console and Sentry breadcrumbs', () => {
    render(
      <Try catch={RouteErrorBoundary}>
        <Flaky />
      </Try>
    );
    expect(console.error).toHaveBeenCalledWith('Unhandled render error:', expect.any(Error));
  });

  it('Try again re-renders the route once the cause has cleared', async () => {
    render(
      <Try catch={RouteErrorBoundary}>
        <Flaky />
      </Try>
    );
    shouldThrow = false;
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Try again'));
    });
    expect(screen.getByText('Recovered content')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  describe('Go back (v0.5.208)', () => {
    // On a modal (food/child detail and add) Try again re-renders the same
    // broken screen, and Android has no swipe-to-dismiss — so a crash that
    // persists left a hardware back button as the only way out.
    function renderCrashed() {
      render(
        <Try catch={RouteErrorBoundary}>
          <Flaky />
        </Try>
      );
    }

    it('offers Go back when there is a screen to return to, and pops on tap', async () => {
      mockCanGoBack.mockReturnValue(true);
      renderCrashed();
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Go back'));
      });
      expect(mockBack).toHaveBeenCalledTimes(1);
      // Try again is still offered alongside it.
      expect(screen.getByLabelText('Try again')).toBeTruthy();
    });

    it('hides Go back when nothing is behind this screen', () => {
      // A tab root: back would do nothing (or leave the app), so the action
      // must not be offered at all.
      renderCrashed();
      expect(screen.queryByLabelText('Go back')).toBeNull();
      expect(screen.getByLabelText('Try again')).toBeTruthy();
    });

    it('still renders the recovery screen when the navigator is unavailable', () => {
      // The root boundary renders outside the navigator, where asking it
      // anything can throw. The fallback must not crash on top of a crash.
      mockCanGoBack.mockImplementation(() => {
        throw new Error('navigation not ready');
      });
      renderCrashed();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      expect(screen.queryByLabelText('Go back')).toBeNull();
    });
  });

  describe('theme', () => {
    afterEach(() => setMockTheme('light'));

    // The fallback styles come from a module-level StyleSheet.create factory,
    // so this is the case the mock used to freeze in the light theme.
    function backgroundOfFallback() {
      const { container } = render(
        <Try catch={RouteErrorBoundary}>
          <Flaky />
        </Try>
      );
      // The boundary's outermost View carries `styles.container`.
      return getComputedStyle(container.firstChild as HTMLElement).backgroundColor;
    }

    it('paints the recovery screen with the light background in light mode', () => {
      expect(backgroundOfFallback()).toBe(rgb(lightTheme.colors.background));
    });

    it('paints the recovery screen with the dark background in dark mode', () => {
      setMockTheme('dark');
      expect(backgroundOfFallback()).toBe(rgb(darkTheme.colors.background));
    });
  });
});
