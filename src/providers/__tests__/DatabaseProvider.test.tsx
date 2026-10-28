import { StrictMode } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react';
import { click } from '@/src/test-utils/screen-helpers';

const mockExecAsync = jest.fn();
jest.mock('../../db/client', () => ({
  expoDb: {
    // The runner issues ROLLBACK after a failed step; answer it here so each
    // queued mock value below still describes one migration attempt.
    execAsync: (source: string) =>
      source === 'ROLLBACK;' ? Promise.resolve() : mockExecAsync(source),
    // A pre-runner install: user_version 0, so the baseline step is applied.
    getFirstAsync: async () => ({ user_version: 0 }),
  },
}));

import { DatabaseProvider } from '../DatabaseProvider';
import { MIGRATION_SQL } from '../../db/migration';
import { lightTheme } from '../../styles/theme';

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

async function renderProvider() {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <DatabaseProvider>
        <Text>App content</Text>
      </DatabaseProvider>
    );
  });
  return utils;
}

describe('DatabaseProvider', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockExecAsync.mockReset();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('runs the migration and then renders the app', async () => {
    mockExecAsync.mockResolvedValueOnce(undefined);
    const { getByText } = await renderProvider();
    // Through the versioned runner, not a bare exec: the baseline is applied
    // and the version recorded in the same call.
    const [sql] = mockExecAsync.mock.calls[0];
    expect(sql).toContain(MIGRATION_SQL);
    expect(sql).toContain('PRAGMA user_version = 1');
    expect(getByText('App content')).toBeTruthy();
  });

  it('turns foreign keys on once the migrations have run, before rendering the app', async () => {
    mockExecAsync.mockResolvedValue(undefined);
    const { getByText } = await renderProvider();

    const calls = mockExecAsync.mock.calls.map(([sql]) => sql as string);
    const pragma = calls.indexOf('PRAGMA foreign_keys = ON;');
    expect(pragma).toBe(calls.length - 1);
    // Every migration step ran before it.
    expect(calls.slice(0, pragma).some((sql) => sql.includes('PRAGMA user_version = 2'))).toBe(true);
    expect(getByText('App content')).toBeTruthy();
  });

  it('does not turn foreign keys on when a migration fails', async () => {
    mockExecAsync.mockRejectedValueOnce(new Error('database is locked'));
    await renderProvider();

    expect(mockExecAsync).not.toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
  });

  it('logs a failed migration so it reaches Sentry, and does not render the app', async () => {
    const failure = new Error('database is locked');
    mockExecAsync.mockRejectedValueOnce(failure);
    const { getByText, queryByText } = await renderProvider();

    expect(getByText('Database Error: database is locked')).toBeTruthy();
    expect(queryByText('App content')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('Failed to initialize database:', failure);
  });

  it('offers a retry that re-runs the migration and recovers', async () => {
    mockExecAsync.mockRejectedValueOnce(new Error('database is locked'));
    mockExecAsync.mockResolvedValueOnce(undefined);
    const { getByText, queryByText } = await renderProvider();

    await click('Retry opening the database');

    // The retry starts again from the baseline step (user_version is still 0).
    expect(mockExecAsync.mock.calls[1][0]).toContain(MIGRATION_SQL);
    expect(queryByText(/Database Error/)).toBeNull();
    expect(getByText('App content')).toBeTruthy();
  });

  it('stays on the error screen, retryable, when the retry also fails', async () => {
    mockExecAsync.mockRejectedValueOnce(new Error('first'));
    mockExecAsync.mockRejectedValueOnce(new Error('second'));
    const { getByText, queryByText } = await renderProvider();

    await click('Retry opening the database');

    expect(getByText('Database Error: second')).toBeTruthy();
    expect(queryByText('App content')).toBeNull();
  });

  it('runs the migrations once when initialisation is started twice concurrently', async () => {
    // StrictMode mounts, unmounts and re-mounts every effect in development,
    // so the init effect fires twice before the first run has finished. Both
    // runs would read user_version 0 and apply every step; once a step is a
    // non-idempotent ALTER TABLE, the second run fails "duplicate column" and
    // its error screen covers the first run's success.
    mockExecAsync.mockResolvedValue(undefined);
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <StrictMode>
          <DatabaseProvider>
            <Text>App content</Text>
          </DatabaseProvider>
        </StrictMode>
      );
    });

    const calls = mockExecAsync.mock.calls.map(([sql]) => sql as string);
    expect(calls.filter((sql) => sql.includes('PRAGMA user_version = 1'))).toHaveLength(1);
    expect(calls.filter((sql) => sql === 'PRAGMA foreign_keys = ON;')).toHaveLength(1);
    expect(utils.getByText('App content')).toBeTruthy();
  });

  it('draws the error screen in theme colours, not hardcoded ones', async () => {
    // It used CSS 'red' (4.00:1 on white, under AA for body text) and a hex
    // literal for the retry link, and set no background, so in dark mode the
    // light-theme ink sat on whatever was behind it.
    mockExecAsync.mockRejectedValueOnce(new Error('database is locked'));
    const { getByText } = await renderProvider();

    const message = getByText('Database Error: database is locked');
    expect(getComputedStyle(message).color).toBe(rgb(lightTheme.colors.error));
    expect(getComputedStyle(getByText('Try Again')).color).toBe(
      rgb(lightTheme.colors.primaryStrong)
    );
    expect(getComputedStyle(message.parentElement as HTMLElement).backgroundColor).toBe(
      rgb(lightTheme.colors.background)
    );
  });
});
