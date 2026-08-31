/**
 * Minimal fake of the drizzle expo-sqlite query builder, for screen tests.
 *
 * The `app/` screens talk to the database through a handful of chains:
 *   db.select(<projection?>).from(t).where(c)            -> thenable rows
 *   db.select().from(t).where(c).orderBy(o)              -> thenable rows
 *   db.insert(t).values(v)                               -> promise
 *   db.update(t).set(v).where(c)                         -> promise
 *   db.delete(t).where(c)                                -> promise
 *
 * Reads resolve from a queue of canned result sets (FIFO, in the order the
 * screen issues them) and default to `[]` once the queue is drained, so a
 * test only has to describe the reads it cares about. Writes are recorded
 * so a test can assert what the screen persisted.
 *
 * Deliberately structural rather than a `jest.mock` of drizzle itself:
 * screens import the `db` singleton from `@/src/db/client`, so the seam is
 * that module, and a hand-rolled fake keeps the assertions readable.
 */
export type RecordedWrite =
  | { kind: 'insert'; values: unknown }
  | { kind: 'update'; values: unknown }
  | { kind: 'delete' };

export type MockDb = {
  db: unknown;
  /** Queue a result set for the next (or Nth) read, in issue order. */
  queueSelect: (rows: unknown[]) => void;
  writes: RecordedWrite[];
  selectCount: () => number;
  /** Make every subsequent read reject, to exercise a screen's catch block. */
  failReads: (error?: Error) => void;
};

export function createMockDb(): MockDb {
  const queue: unknown[][] = [];
  const writes: RecordedWrite[] = [];
  let reads = 0;
  let readError: Error | null = null;

  const resolveRead = (): Promise<unknown[]> => {
    reads += 1;
    if (readError) return Promise.reject(readError);
    return Promise.resolve(queue.shift() ?? []);
  };

  // Every read-chain link returns the same thenable, so any suffix of
  // .from/.where/.orderBy/.limit resolves identically.
  const makeReadChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    for (const link of ['from', 'where', 'orderBy', 'limit', 'innerJoin', 'leftJoin']) {
      chain[link] = () => chain;
    }
    chain.then = (onFulfilled: (r: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
      resolveRead().then(onFulfilled, onRejected);
    chain.catch = (onRejected: (e: unknown) => unknown) => resolveRead().catch(onRejected);
    return chain;
  };

  const db = {
    select: () => makeReadChain(),
    insert: () => ({
      values: (values: unknown) => {
        writes.push({ kind: 'insert', values });
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: () => {
          writes.push({ kind: 'update', values });
          return Promise.resolve();
        },
      }),
    }),
    delete: () => ({
      where: () => {
        writes.push({ kind: 'delete' });
        return Promise.resolve();
      },
    }),
  };

  return {
    db,
    queueSelect: (rows) => queue.push(rows),
    writes,
    selectCount: () => reads,
    failReads: (error = new Error('read failed')) => {
      readError = error;
    },
  };
}
