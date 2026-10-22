/**
 * The CSV export hands a child's whole feeding history to the share sheet, so
 * the helper that reads it must refuse a child outside the signed-in family by
 * itself — not only because today's one caller (Settings, v0.5.197) checks
 * first. Real SQL, because `createMockDb` never evaluates a `where`.
 */
import { Share } from 'react-native';
import { createSqliteDb, seedTwoFamilies } from '@/src/test-utils/sqlite-db';

let mockSqlite: ReturnType<typeof createSqliteDb>;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockSqlite.db;
  },
}));

import { fetchExportRows, exportChildData } from '../export';

beforeEach(() => {
  mockSqlite = createSqliteDb();
  seedTwoFamilies(mockSqlite.raw);
});

describe('fetchExportRows family scope', () => {
  it("returns the family's own child's exposures", async () => {
    const rows = await fetchExportRows('c1', 'f1');
    expect(rows.map((r) => r.foodName).sort()).toEqual(['Apple', 'Pear']);
  });

  it("returns nothing for another family's child", async () => {
    expect(await fetchExportRows('c9', 'f1')).toEqual([]);
  });

  it('scopes by the family it is given, not a fixed one', async () => {
    const rows = await fetchExportRows('c9', 'f2');
    expect(rows.map((r) => r.foodName)).toEqual(['Kiwi']);
  });

  it('returns nothing when no family is signed in', async () => {
    expect(await fetchExportRows('c1', '')).toEqual([]);
  });
});

describe('exportChildData family scope', () => {
  it("shares a header-only CSV, never another family's rows", async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction' } as never);

    await exportChildData({ childId: 'c9', familyId: 'f1', childName: 'Other' });

    const arg = shareSpy.mock.calls[0][0] as { message: string };
    expect(arg.message).not.toContain('Kiwi');
    expect(arg.message.trim().split('\n')).toHaveLength(1);
    shareSpy.mockRestore();
  });
});
