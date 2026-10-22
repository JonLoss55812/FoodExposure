import { compareExposuresNewestFirst } from '../exposure-order';

const row = (occurredAt: Date | number, createdAt?: Date | number | null) => ({
  occurredAt,
  createdAt,
});

describe('compareExposuresNewestFirst', () => {
  it('orders by occurredAt, newest first, regardless of createdAt', () => {
    const newer = row(new Date(2026, 8, 10), new Date(2026, 8, 1));
    const older = row(new Date(2026, 8, 1), new Date(2026, 8, 20));
    expect([older, newer].sort(compareExposuresNewestFirst)).toEqual([newer, older]);
  });

  it('breaks an occurredAt tie by createdAt, newest-logged first', () => {
    const day = new Date(2026, 8, 8);
    const loggedFirst = row(day, new Date(2026, 8, 8, 9));
    const loggedLater = row(day, new Date(2026, 8, 9, 9));
    expect([loggedFirst, loggedLater].sort(compareExposuresNewestFirst)).toEqual([
      loggedLater,
      loggedFirst,
    ]);
    expect([loggedLater, loggedFirst].sort(compareExposuresNewestFirst)).toEqual([
      loggedLater,
      loggedFirst,
    ]);
  });

  it('accepts numeric instants as well as Dates', () => {
    const a = row(1000, 5);
    const b = row(1000, 9);
    expect(compareExposuresNewestFirst(a, b)).toBeGreaterThan(0);
    expect(compareExposuresNewestFirst(b, a)).toBeLessThan(0);
  });

  it('sorts a row without createdAt after a tied row that has one', () => {
    const day = new Date(2026, 8, 8);
    const missing = row(day, null);
    const present = row(day, new Date(2026, 8, 8, 9));
    expect([missing, present].sort(compareExposuresNewestFirst)).toEqual([present, missing]);
  });

  it('returns 0 for a full tie, so a stable sort keeps the loaded order', () => {
    const day = new Date(2026, 8, 8);
    expect(compareExposuresNewestFirst(row(day, 5), row(day, 5))).toBe(0);
    expect(compareExposuresNewestFirst(row(day), row(day))).toBe(0);
  });
});
