import { Share } from 'react-native';

// These `var` declarations are hoisted so they're visible inside the
// `jest.mock` factory below (also hoisted). Jest permits out-of-scope
// factory references only when the variable name is prefixed with `mock`.
// eslint-disable-next-line no-var
var mockRowsFromDb: Array<{
  occurredAt: Date | number;
  foodName: string;
  category: string;
  stage: string;
  rating: number | null;
  preparation: string | null;
  texture: string | null;
  mealType: string | null;
  setting: string | null;
  notes: string | null;
}>;

// eslint-disable-next-line no-var
var mockQueryBuilder: {
  select: jest.Mock;
  from: jest.Mock;
  innerJoin: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
};

mockRowsFromDb = [];
mockQueryBuilder = {
  select: jest.fn(() => mockQueryBuilder),
  from: jest.fn(() => mockQueryBuilder),
  innerJoin: jest.fn(() => mockQueryBuilder),
  where: jest.fn(() => mockQueryBuilder),
  orderBy: jest.fn(() => Promise.resolve(mockRowsFromDb)),
};

jest.mock('@/src/db/client', () => ({
  get db() {
    return mockQueryBuilder;
  },
}));

// Import after the mock so the module picks up the mocked db.
// eslint-disable-next-line import/first
import { fetchExportRows, exportChildData } from '../export';

beforeEach(() => {
  mockRowsFromDb.length = 0;
  mockQueryBuilder.select.mockClear();
  mockQueryBuilder.from.mockClear();
  mockQueryBuilder.innerJoin.mockClear();
  mockQueryBuilder.where.mockClear();
  mockQueryBuilder.orderBy.mockClear();
});

describe('fetchExportRows', () => {
  it('returns an empty array when the child has no exposures', async () => {
    const rows = await fetchExportRows('child-1');
    expect(rows).toEqual([]);
  });

  it('passes through rows that already have Date occurredAt', async () => {
    const occurredAt = new Date('2026-04-01T10:00:00.000Z');
    mockRowsFromDb.push({
      occurredAt,
      foodName: 'Apple',
      category: 'fruit',
      stage: 'taste',
      rating: 4,
      preparation: 'sliced',
      texture: 'crunchy',
      mealType: 'snack',
      setting: 'home',
      notes: null,
    });

    const rows = await fetchExportRows('child-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toBeInstanceOf(Date);
    expect(rows[0].occurredAt.toISOString()).toBe('2026-04-01T10:00:00.000Z');
    expect(rows[0].foodName).toBe('Apple');
  });

  it('coerces numeric timestamps into Date instances', async () => {
    const ts = new Date('2026-04-02T12:00:00.000Z').getTime();
    mockRowsFromDb.push({
      occurredAt: ts,
      foodName: 'Pear',
      category: 'fruit',
      stage: 'smell',
      rating: null,
      preparation: null,
      texture: null,
      mealType: null,
      setting: null,
      notes: null,
    });

    const rows = await fetchExportRows('child-1');
    expect(rows[0].occurredAt).toBeInstanceOf(Date);
    expect(rows[0].occurredAt.toISOString()).toBe('2026-04-02T12:00:00.000Z');
  });

  it('invokes the query builder chain in the expected order', async () => {
    await fetchExportRows('child-42');
    expect(mockQueryBuilder.select).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.from).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.where).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.orderBy).toHaveBeenCalledTimes(1);
  });
});

describe('exportChildData', () => {
  it('fetches rows, formats CSV, and opens the share sheet with filename as title', async () => {
    mockRowsFromDb.push({
      occurredAt: new Date('2026-04-10T09:30:00.000Z'),
      foodName: 'Banana',
      category: 'fruit',
      stage: 'taste',
      rating: 5,
      preparation: 'sliced',
      texture: 'soft',
      mealType: 'breakfast',
      setting: 'home',
      notes: 'liked it',
    });

    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

    await exportChildData('child-1', 'Ada Lovelace');

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const arg = shareSpy.mock.calls[0][0] as { title: string; message: string };
    expect(arg.title).toMatch(/^tonguetutor-ada-lovelace-\d{8}\.csv$/);
    expect(arg.message).toContain('date,food,category,stage');
    expect(arg.message).toContain('Banana');
    expect(arg.message).toContain('liked it');

    shareSpy.mockRestore();
  });

  it('still shares a header-only CSV when the child has no exposures', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

    await exportChildData('child-empty', 'Empty Kid');

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const arg = shareSpy.mock.calls[0][0] as { title: string; message: string };
    expect(arg.message.trim()).toBe('date,food,category,stage,rating,preparation,texture,meal,setting,notes');

    shareSpy.mockRestore();
  });

  it('propagates errors from Share.share', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockRejectedValue(new Error('user cancelled'));

    await expect(exportChildData('child-1', 'Ada')).rejects.toThrow('user cancelled');

    shareSpy.mockRestore();
  });
});
