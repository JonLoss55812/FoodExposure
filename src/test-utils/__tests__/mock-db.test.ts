import { createMockDb } from '../mock-db';

type WriteDb = {
  insert: (t: unknown) => { values: (v: unknown) => Promise<void> };
  update: (t: unknown) => { set: (v: unknown) => { where: (w: unknown) => Promise<void> } };
  delete: (t: unknown) => { where: (w: unknown) => Promise<void> };
};

describe('createMockDb failNextWrite', () => {
  it('rejects exactly the next write, records nothing for it, and lets the retry through', async () => {
    const mock = createMockDb();
    const db = mock.db as WriteDb;
    mock.failNextWrite();

    await expect(db.insert({}).values({ id: 'a' })).rejects.toThrow('write failed');
    expect(mock.writes).toHaveLength(0);

    await db.insert({}).values({ id: 'a' });
    expect(mock.writes).toEqual([{ kind: 'insert', values: { id: 'a' } }]);
  });

  it('applies to whichever write kind comes next, with a custom error', async () => {
    const mock = createMockDb();
    const db = mock.db as WriteDb;

    mock.failNextWrite(new Error('update boom'));
    await expect(db.update({}).set({ a: 1 }).where('w')).rejects.toThrow('update boom');

    mock.failNextWrite();
    await expect(db.delete({}).where('w')).rejects.toThrow('write failed');

    expect(mock.writes).toHaveLength(0);
    await db.delete({}).where('w');
    expect(mock.writes).toEqual([{ kind: 'delete', where: 'w' }]);
  });

  it('does not touch reads', async () => {
    const mock = createMockDb();
    const db = mock.db as { select: () => { from: () => PromiseLike<unknown[]> } };
    mock.queueSelect([{ id: 'r' }]);
    mock.failNextWrite();
    await expect(db.select().from()).resolves.toEqual([{ id: 'r' }]);
  });
});
