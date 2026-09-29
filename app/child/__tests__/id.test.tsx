/**
 * Screen tests for `app/child/[id].tsx` — the edit half of NEXT_STEPS gap
 * #-1.5. A child's date of birth and notes were captured on Add Child and,
 * since v0.5.178, displayed on the Settings row, but nothing could change
 * them: a typo was permanent short of Delete Child, which cascades away every
 * exposure the child has logged.
 *
 * What has to be true here: the form is seeded from the stored row; Save is an
 * `update` scoped to *this* child's id (not an insert, which would fork the
 * child in two); clearing an optional field persists `null`, not `''`; editing
 * does not switch the app's selected child the way adding one does; and a
 * failed write is retryable.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { eq } from 'drizzle-orm';
import * as schema from '@/src/db/schema';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
let mockParams: { id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import ChildDetailScreen from '../[id]';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

const NOAH = {
  id: 'child-2',
  name: 'Noah',
  dateOfBirth: '2024-03-15',
  avatarEmoji: '👦',
  notes: 'Gags on mixed textures',
};

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function valueOf(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

async function renderWith(rows: unknown[]) {
  mockDb.queueSelect(rows);
  await act(async () => {
    render(<ChildDetailScreen />);
  });
}

async function tapSave() {
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Save Changes'));
  });
}

function updates() {
  return mockDb.writes.filter((w) => w.kind === 'update') as {
    kind: 'update';
    values: Record<string, unknown>;
    where: unknown;
  }[];
}

describe('ChildDetailScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    mockParams = { id: NOAH.id };
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      userId: 'user-1',
      familyId: 'fam-1',
      email: 'anne@tonguetutor.app',
      displayName: 'Anne',
    });
    useChildStore.getState().selectChild('child-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('seeds every field from the stored row', async () => {
    await renderWith([NOAH]);
    expect(valueOf("Child's name")).toBe('Noah');
    expect(valueOf('Date of birth (optional)')).toBe('2024-03-15');
    expect(valueOf('Notes (optional)')).toBe('Gags on mixed textures');
  });

  it('updates this child by id, and never inserts a second row', async () => {
    await renderWith([NOAH]);
    type('Date of birth (optional)', '2024-03-05');
    type('Notes (optional)', '  Now tolerates purees  ');
    await tapSave();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockDb.writes.map((w) => w.kind)).toEqual(['update']);
    const [write] = updates();
    expect(write.values).toEqual({
      name: 'Noah',
      dateOfBirth: '2024-03-05',
      avatarEmoji: '👦',
      notes: 'Now tolerates purees',
    });
    expect(write.where).toEqual(eq(schema.children.id, NOAH.id));
  });

  it('persists a cleared date of birth and notes as null, not an empty string', async () => {
    await renderWith([NOAH]);
    type('Date of birth (optional)', '');
    type('Notes (optional)', '   ');
    await tapSave();

    await waitFor(() => expect(updates()).toHaveLength(1));
    expect(updates()[0].values).toMatchObject({ dateOfBirth: null, notes: null });
  });

  it('seeds an absent date and notes as empty and keeps them null on save', async () => {
    await renderWith([{ ...NOAH, dateOfBirth: null, notes: null }]);
    expect(valueOf('Date of birth (optional)')).toBe('');
    type("Child's name", 'Noah B');
    await tapSave();

    await waitFor(() => expect(updates()).toHaveLength(1));
    expect(updates()[0].values).toMatchObject({ name: 'Noah B', dateOfBirth: null, notes: null });
  });

  it('does not switch the selected child the way adding one does', async () => {
    await renderWith([NOAH]);
    await tapSave();
    await waitFor(() => expect(updates()).toHaveLength(1));
    expect(useChildStore.getState().selectedChildId).toBe('child-1');
  });

  it('rejects a future date of birth through the schema and writes nothing', async () => {
    await renderWith([NOAH]);
    type('Date of birth (optional)', '2099-01-01');
    await tapSave();

    expect(await screen.findByText('Date of birth cannot be in the future')).toBeTruthy();
    expect(mockDb.writes).toHaveLength(0);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('shows a not-found state for an id outside this family', async () => {
    await renderWith([]);
    expect(screen.getByText('Child Not Found')).toBeTruthy();
    expect(screen.queryByLabelText('Save Changes')).toBeNull();
  });

  it('alerts on a failed load rather than pretending the child is missing silently', async () => {
    mockDb.failReads();
    await act(async () => {
      render(<ChildDetailScreen />);
    });
    expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to load child'));
  });

  it('alerts on a failed save, stays on the screen, and stays retryable', async () => {
    await renderWith([NOAH]);
    mockDb.failNextWrite();
    type('Notes (optional)', 'Licked a carrot');
    await tapSave();

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('Failed to save child')),
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(valueOf('Notes (optional)')).toBe('Licked a carrot');

    await tapSave();
    await waitFor(() => expect(updates()).toHaveLength(1));
    expect(updates()[0].values).toMatchObject({ notes: 'Licked a carrot' });
  });
});
