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
  | { kind: 'update'; values: unknown; where: unknown }
  | { kind: 'delete'; where: unknown };

export type MockDb = {
  db: unknown;
  /** Queue a result set for the next (or Nth) read, in issue order. */
  queueSelect: (rows: unknown[]) => void;
  writes: RecordedWrite[];
  selectCount: () => number;
  /** Make every subsequent read reject, to exercise a screen's catch block. */
  failReads: (error?: Error) => void;
  /**
   * Make the next write — insert, update or delete, whichever comes first —
   * reject without being recorded; every write after it succeeds normally.
   * This is how a test reaches a write handler's catch block and then proves
   * the retry gets through (i.e. the in-flight latch was released).
   */
  failNextWrite: (error?: Error) => void;
};

export function createMockDb(): MockDb {
  const queue: unknown[][] = [];
  const writes: RecordedWrite[] = [];
  let reads = 0;
  let readError: Error | null = null;
  let nextWriteError: Error | null = null;

  const recordWrite = (write: RecordedWrite): Promise<void> => {
    if (nextWriteError) {
      const error = nextWriteError;
      nextWriteError = null;
      return Promise.reject(error);
    }
    writes.push(write);
    return Promise.resolve();
  };

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
      values: (values: unknown) => recordWrite({ kind: 'insert', values }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        // The predicate is recorded for the same reason as on `delete`: an
        // update scoped to the wrong column rewrites rows the user never
        // named, with nothing on screen to say so.
        where: (where: unknown) => recordWrite({ kind: 'update', values, where }),
      }),
    }),
    delete: () => ({
      // The predicate is recorded so a caller can assert a delete is scoped to
      // the row it named — a wrong-column/wrong-id delete is silent otherwise.
      where: (where: unknown) => recordWrite({ kind: 'delete', where }),
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
    failNextWrite: (error = new Error('write failed')) => {
      nextWriteError = error;
    },
  };
}
