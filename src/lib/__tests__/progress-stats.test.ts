import {
  calcProgressStats,
  getEncouragementMessage,
  type ProgressStats,
  type StatsFood,
  type StatsExposure,
} from '../progress-stats';

const NOW = new Date('2026-04-26T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

const food = (overrides: Partial<StatsFood> & { id: string; name: string; category: string }): StatsFood => ({
  isSafeFood: false,
  ...overrides,
});

const expo = (overrides: Partial<StatsExposure> & { foodId: string; stage: string; occurredAt: Date | number }): StatsExposure => ({
  rating: null,
  ...overrides,
});

describe('calcProgressStats', () => {
  it('returns zeroed stats for empty inputs', () => {
    const stats = calcProgressStats([], [], 'typical', NOW);
    expect(stats).toEqual({
      totalFoods: 0,
      totalExposures: 0,
      safeFoods: 0,
      stageCounts: {},
      categoryCounts: {},
      weeklyExposures: 0,
      avgRating: 0,
      foodsNearTarget: 0,
      foodProgress: [],
    });
  });

  it('falls back to Date.now() when called without an explicit `now`', () => {
    // Default-arg branch: every other test passes NOW explicitly, so the
    // `now: number = Date.now()` fallback was uncovered. Empty inputs make
    // the assertion deterministic — no field depends on the wall clock.
    const stats = calcProgressStats([], [], 'typical');
    expect(stats.totalFoods).toBe(0);
    expect(stats.weeklyExposures).toBe(0);
  });

  it('counts safe foods from the foods table independent of exposures', () => {
    const foods = [
      food({ id: 'a', name: 'Apple', category: 'fruit', isSafeFood: true }),
      food({ id: 'b', name: 'Broccoli', category: 'vegetable', isSafeFood: false }),
      food({ id: 'c', name: 'Chicken', category: 'protein', isSafeFood: true }),
    ];
    const stats = calcProgressStats(foods, [], 'typical', NOW);
    expect(stats.safeFoods).toBe(2);
    expect(stats.categoryCounts).toEqual({ fruit: 1, vegetable: 1, protein: 1 });
  });

  it('tracks the highest stage reached per food', () => {
    const foods = [food({ id: 'a', name: 'Apple', category: 'fruit' })];
    const exposures = [
      expo({ foodId: 'a', stage: 'tolerate', occurredAt: NOW }),
      expo({ foodId: 'a', stage: 'taste', occurredAt: NOW }),
      expo({ foodId: 'a', stage: 'smell', occurredAt: NOW }),
    ];
    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.totalFoods).toBe(1);
    expect(stats.stageCounts).toEqual({ taste: 1 });
  });

  it('computes weekly exposures within the trailing 7-day window', () => {
    const foods = [food({ id: 'a', name: 'Apple', category: 'fruit' })];
    const exposures = [
      expo({ foodId: 'a', stage: 'eat', occurredAt: NOW - DAY }),       // 1 day ago — in
      expo({ foodId: 'a', stage: 'eat', occurredAt: NOW - 6 * DAY }),   // 6 days ago — in
      expo({ foodId: 'a', stage: 'eat', occurredAt: NOW - 8 * DAY }),   // 8 days ago — out
      expo({ foodId: 'a', stage: 'eat', occurredAt: new Date(NOW - 2 * DAY) }), // Date instance — in
    ];
    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.weeklyExposures).toBe(3);
    expect(stats.totalExposures).toBe(4);
  });

  it('averages ratings only over exposures that have a rating', () => {
    const foods = [food({ id: 'a', name: 'Apple', category: 'fruit' })];
    const exposures = [
      expo({ foodId: 'a', stage: 'eat', occurredAt: NOW, rating: 4 }),
      expo({ foodId: 'a', stage: 'eat', occurredAt: NOW, rating: 5 }),
      expo({ foodId: 'a', stage: 'eat', occurredAt: NOW, rating: null }),
    ];
    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.avgRating).toBe(4.5);
  });

  it('returns avgRating === 0 when no exposures carry a rating', () => {
    const foods = [food({ id: 'a', name: 'Apple', category: 'fruit' })];
    const exposures = [expo({ foodId: 'a', stage: 'eat', occurredAt: NOW })];
    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.avgRating).toBe(0);
  });

  it('builds per-food progress sorted by pct descending then count descending, dropping zero-exposure foods', () => {
    const foods = [
      food({ id: 'a', name: 'Apple', category: 'fruit' }),       // 6 → pct 0.4
      food({ id: 'b', name: 'Broccoli', category: 'vegetable' }), // 12 → pct 0.8
      food({ id: 'c', name: 'Chicken', category: 'protein' }),   // 0 → dropped
      food({ id: 'd', name: 'Dough', category: 'grain' }),       // 12 → pct 0.8 (tie, count tie)
    ];
    const exposures: StatsExposure[] = [];
    for (let i = 0; i < 6; i++) exposures.push(expo({ foodId: 'a', stage: 'eat', occurredAt: NOW }));
    for (let i = 0; i < 12; i++) exposures.push(expo({ foodId: 'b', stage: 'eat', occurredAt: NOW }));
    for (let i = 0; i < 12; i++) exposures.push(expo({ foodId: 'd', stage: 'eat', occurredAt: NOW }));

    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.foodProgress.map((r) => r.foodId)).toEqual(['b', 'd', 'a']);
    expect(stats.foodProgress[0]).toMatchObject({ current: 12, threshold: 15, reached: false });
    expect(stats.foodProgress[2].pct).toBeCloseTo(0.4);
  });

  it('flags foodsNearTarget at >=80% but excludes those that already reached the threshold', () => {
    const foods = [
      food({ id: 'a', name: 'Apple', category: 'fruit' }),       // 12/15 = 0.8 → near
      food({ id: 'b', name: 'Broccoli', category: 'vegetable' }), // 15/15 = reached
      food({ id: 'c', name: 'Chicken', category: 'protein' }),   // 5/15 = below
    ];
    const exposures: StatsExposure[] = [];
    for (let i = 0; i < 12; i++) exposures.push(expo({ foodId: 'a', stage: 'eat', occurredAt: NOW }));
    for (let i = 0; i < 15; i++) exposures.push(expo({ foodId: 'b', stage: 'eat', occurredAt: NOW }));
    for (let i = 0; i < 5; i++) exposures.push(expo({ foodId: 'c', stage: 'eat', occurredAt: NOW }));

    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.foodsNearTarget).toBe(1);
  });

  it('skips unknown stage strings when computing stageCounts but still counts foods toward totalFoods', () => {
    const foods = [
      food({ id: 'a', name: 'Apple', category: 'fruit' }),
      food({ id: 'b', name: 'Broccoli', category: 'vegetable' }),
    ];
    const exposures = [
      // Food a: only legacy/unknown stage strings — should land in totalFoods
      // (still a "food tried") but not in stageCounts (no valid stage to bucket).
      expo({ foodId: 'a', stage: 'mystery', occurredAt: NOW }),
      expo({ foodId: 'a', stage: 'legacy_taste', occurredAt: NOW }),
      // Food b: a real stage — buckets normally.
      expo({ foodId: 'b', stage: 'eat', occurredAt: NOW }),
    ];
    const stats = calcProgressStats(foods, exposures, 'typical', NOW);
    expect(stats.totalFoods).toBe(2);
    expect(stats.totalExposures).toBe(3);
    expect(stats.stageCounts).toEqual({ eat: 1 });
  });

  it('respects the picky profile threshold (20)', () => {
    const foods = [food({ id: 'a', name: 'Apple', category: 'fruit' })];
    const exposures: StatsExposure[] = [];
    for (let i = 0; i < 16; i++) exposures.push(expo({ foodId: 'a', stage: 'eat', occurredAt: NOW }));

    const stats = calcProgressStats(foods, exposures, 'picky', NOW);
    expect(stats.foodProgress[0]).toMatchObject({
      current: 16,
      threshold: 20,
      reached: false,
    });
    expect(stats.foodProgress[0].pct).toBeCloseTo(0.8);
    expect(stats.foodsNearTarget).toBe(1);
  });
});

describe('getEncouragementMessage', () => {
  const baseStats = (overrides: Partial<ProgressStats> = {}): ProgressStats => ({
    totalFoods: 0,
    totalExposures: 0,
    safeFoods: 0,
    stageCounts: {},
    categoryCounts: {},
    weeklyExposures: 0,
    avgRating: 0,
    foodsNearTarget: 0,
    foodProgress: [],
    ...overrides,
  });

  it('greets a fresh user when no exposures logged', () => {
    expect(getEncouragementMessage(baseStats({ totalExposures: 0 }))).toMatch(
      /every journey begins/i,
    );
  });

  it('encourages early users with fewer than 10 exposures', () => {
    expect(getEncouragementMessage(baseStats({ totalExposures: 5 }))).toMatch(
      /great start/i,
    );
  });

  it('boundary: exactly 10 exposures is no longer "early" (uses 10+ branches)', () => {
    expect(getEncouragementMessage(baseStats({ totalExposures: 10 }))).toMatch(
      /amazing progress/i,
    );
  });

  it('calls out near-target foods when at least one is close, using its threshold', () => {
    const stats = baseStats({
      totalExposures: 50,
      foodsNearTarget: 2,
      foodProgress: [
        {
          foodId: 'a',
          foodName: 'Apple',
          category: 'fruit',
          current: 17,
          threshold: 20,
          pct: 0.85,
          reached: false,
        },
      ],
    });
    expect(getEncouragementMessage(stats)).toBe(
      '2 food(s) are getting close to the 20-exposure target!',
    );
  });

  it('falls back to threshold 15 when foodProgress is empty but foodsNearTarget > 0', () => {
    const stats = baseStats({
      totalExposures: 30,
      foodsNearTarget: 1,
      foodProgress: [],
    });
    expect(getEncouragementMessage(stats)).toContain('15-exposure');
  });

  it('celebrates established users with 10+ exposures and nothing near target', () => {
    const stats = baseStats({ totalExposures: 30, foodsNearTarget: 0 });
    expect(getEncouragementMessage(stats)).toMatch(/amazing progress/i);
  });
});
