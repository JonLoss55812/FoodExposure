import { Text } from 'react-native';
import { act, render } from '@testing-library/react';
import { click } from '@/src/test-utils/screen-helpers';

const mockExecAsync = jest.fn();
jest.mock('../../db/client', () => ({
  expoDb: { execAsync: (...args: unknown[]) => mockExecAsync(...args) },
}));

import { DatabaseProvider } from '../DatabaseProvider';
import { MIGRATION_SQL } from '../../db/migration';

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
    expect(mockExecAsync).toHaveBeenCalledWith(MIGRATION_SQL);
    expect(getByText('App content')).toBeTruthy();
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

    expect(mockExecAsync).toHaveBeenCalledTimes(2);
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
});
