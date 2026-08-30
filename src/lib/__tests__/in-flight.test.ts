import { createInFlightLatch } from '../in-flight';

describe('createInFlightLatch', () => {
  it('starts unheld', () => {
    expect(createInFlightLatch().busy).toBe(false);
  });

  it('grants the first acquire and marks itself busy', () => {
    const latch = createInFlightLatch();
    expect(latch.tryAcquire()).toBe(true);
    expect(latch.busy).toBe(true);
  });

  // The load-bearing case: this is exactly what a `useState` guard fails.
  // Two callers in the same synchronous tick — no re-render between them —
  // must not both proceed into the write.
  it('rejects a second acquire in the same synchronous tick', () => {
    const latch = createInFlightLatch();
    const results = [latch.tryAcquire(), latch.tryAcquire(), latch.tryAcquire()];
    expect(results).toEqual([true, false, false]);
  });

  it('re-grants after release', () => {
    const latch = createInFlightLatch();
    expect(latch.tryAcquire()).toBe(true);
    latch.release();
    expect(latch.busy).toBe(false);
    expect(latch.tryAcquire()).toBe(true);
  });

  it('treats release without a prior acquire as a no-op', () => {
    const latch = createInFlightLatch();
    expect(() => latch.release()).not.toThrow();
    expect(latch.busy).toBe(false);
    expect(latch.tryAcquire()).toBe(true);
  });

  it('does not share state between independent latches', () => {
    const a = createInFlightLatch();
    const b = createInFlightLatch();
    expect(a.tryAcquire()).toBe(true);
    expect(b.tryAcquire()).toBe(true);
    a.release();
    expect(a.busy).toBe(false);
    expect(b.busy).toBe(true);
  });

  // Demonstrates the failure the latch prevents: a concurrent handler that
  // does check-then-insert must run its body exactly once even when fired
  // twice before the first run resolves.
  it('admits exactly one concurrent async handler run', async () => {
    const latch = createInFlightLatch();
    const inserts: number[] = [];

    const handler = async (n: number) => {
      if (!latch.tryAcquire()) return;
      try {
        await Promise.resolve();
        inserts.push(n);
      } finally {
        latch.release();
      }
    };

    // Both fired before either awaits to completion.
    await Promise.all([handler(1), handler(2)]);
    expect(inserts).toEqual([1]);

    // Once settled, the handler is usable again.
    await handler(3);
    expect(inserts).toEqual([1, 3]);
  });
});
