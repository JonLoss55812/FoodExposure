import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
// expo-router's own route boundary: the component that mounts whatever a route
// exports as `ErrorBoundary`. Driving the real one, rather than a hand-rolled
// class, means these tests exercise the same catch -> fallback -> retry contract
// the app relies on.
import { Try } from 'expo-router/build/views/Try';
import { RouteErrorBoundary } from '../RouteErrorBoundary';

const mockCaptureException = jest.fn();

jest.mock('@/src/lib/sentry', () => ({
  Sentry: { captureException: (...args: unknown[]) => mockCaptureException(...args) },
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
});
