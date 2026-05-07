import {
  generateId,
  generateInviteCode,
  formatDate,
  formatRelativeDate,
  getStartOfDay,
  deriveLocalEmailPart,
} from '../utils';

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('returns valid UUID format', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('generateInviteCode', () => {
  it('returns a 6-character string', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
  });

  it('only contains allowed characters (no ambiguous chars)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('generates different codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date(2026, 2, 26); // March 26, 2026
    const result = formatDate(date);
    expect(result).toContain('Mar');
    expect(result).toContain('26');
    expect(result).toContain('2026');
  });
});

describe('formatRelativeDate', () => {
  it('returns "Today" for today', () => {
    expect(formatRelativeDate(new Date())).toBe('Today');
  });

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('Yesterday');
  });

  it('returns "X days ago" for 2-6 days', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns formatted date for 7+ days', () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const result = formatRelativeDate(twoWeeksAgo);
    expect(result).not.toContain('days ago');
  });

  it('returns "Yesterday" for late-evening logs viewed in the early morning', () => {
    // Calendar-day correctness: a parent logs an exposure at 11pm and
    // checks the dashboard at 1am the next day — only 2 wall-clock hours
    // separate the two, but they straddle midnight, so it should show
    // "Yesterday", not "Today". The pre-v0.5.49 implementation returned
    // "Today" because it floored a 2-hour diff to 0 days.
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 3, 1, 0, 0));
    const lateLastNight = new Date(2026, 4, 2, 23, 0, 0);
    expect(formatRelativeDate(lateLastNight)).toBe('Yesterday');
    jest.useRealTimers();
  });

  it('returns "Today" for a same-day log earlier in the day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 3, 18, 0, 0));
    const sameDayMorning = new Date(2026, 4, 3, 7, 30, 0);
    expect(formatRelativeDate(sameDayMorning)).toBe('Today');
    jest.useRealTimers();
  });

  it('returns "Today" for future-dated rows (defensive)', () => {
    // Clock skew or device-time drift can produce a row whose occurredAt
    // is slightly in the future. Old code returned "Today" via floor of a
    // negative diff; new code keeps that via the days <= 0 guard, so an
    // off-by-a-few-minutes timestamp still renders sanely.
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 3, 12, 0, 0));
    const slightlyFuture = new Date(2026, 4, 3, 12, 5, 0);
    expect(formatRelativeDate(slightlyFuture)).toBe('Today');
    jest.useRealTimers();
  });
});

describe('getStartOfDay', () => {
  it('sets time to midnight', () => {
    const date = new Date(2026, 2, 26, 14, 30, 45);
    const start = getStartOfDay(date);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('preserves the date', () => {
    const date = new Date(2026, 2, 26, 14, 30);
    const start = getStartOfDay(date);
    expect(start.getDate()).toBe(26);
    expect(start.getMonth()).toBe(2);
    expect(start.getFullYear()).toBe(2026);
  });

  it('defaults to today', () => {
    const start = getStartOfDay();
    const now = new Date();
    expect(start.getDate()).toBe(now.getDate());
  });

  it('does not mutate the original date', () => {
    const date = new Date(2026, 2, 26, 14, 30);
    getStartOfDay(date);
    expect(date.getHours()).toBe(14);
  });
});

describe('deriveLocalEmailPart', () => {
  it('lowercases an alphanumeric name', () => {
    expect(deriveLocalEmailPart('Anne')).toBe('anne');
  });

  it('strips whitespace from a multi-word name', () => {
    expect(deriveLocalEmailPart('Anne Smith')).toBe('annesmith');
  });

  it('strips RFC-invalid local-part punctuation', () => {
    expect(deriveLocalEmailPart('Jon (Dad)!')).toBe('jondad');
  });

  it('strips emoji and other non-ASCII characters', () => {
    expect(deriveLocalEmailPart('Anne 👶')).toBe('anne');
  });

  it("preserves RFC-safe local-part characters: a-z, 0-9, '.', '+', '-'", () => {
    expect(deriveLocalEmailPart('jane.doe+filter-2')).toBe('jane.doe+filter-2');
  });

  it("falls back to 'user' when input contains only invalid characters", () => {
    expect(deriveLocalEmailPart('👶')).toBe('user');
  });

  it("falls back to 'user' on empty string", () => {
    expect(deriveLocalEmailPart('')).toBe('user');
  });
});

