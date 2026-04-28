import { type ExposureStage } from './constants';
import { calcExposureProgress, type FeedingProfile } from './thresholds';
import { getHighestStage } from './stage';

export interface StatsFood {
  id: string;
  name: string;
  category: string;
  isSafeFood?: boolean | null;
}

export interface StatsExposure {
  foodId: string;
  stage: string;
  rating?: number | null;
  occurredAt: Date | number;
}

export interface FoodProgressRow {
  foodId: string;
  foodName: string;
  category: string;
  current: number;
  threshold: number;
  pct: number;
  reached: boolean;
}

export interface ProgressStats {
  totalFoods: number;
  totalExposures: number;
  safeFoods: number;
  stageCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  weeklyExposures: number;
  avgRating: number;
  foodsNearTarget: number;
  foodProgress: FoodProgressRow[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NEAR_TARGET_PCT = 0.8;

export function calcProgressStats(
  foods: readonly StatsFood[],
  exposures: readonly StatsExposure[],
  profile: FeedingProfile,
  now: number = Date.now(),
): ProgressStats {
  // Bucket exposures by foodId so we can run highest-stage selection
  // through the canonical getHighestStage helper (skips unknown stage
  // strings, matching foods.tsx + index.tsx). Counts and ratings still
  // accumulate in the same single pass.
  const exposuresByFood = new Map<string, StatsExposure[]>();
  const exposureCountPerFood: Record<string, number> = {};
  let totalRating = 0;
  let ratingCount = 0;

  for (const exp of exposures) {
    const foodId = exp.foodId;
    exposureCountPerFood[foodId] = (exposureCountPerFood[foodId] || 0) + 1;

    const bucket = exposuresByFood.get(foodId);
    if (bucket) bucket.push(exp);
    else exposuresByFood.set(foodId, [exp]);

    if (exp.rating != null) {
      totalRating += exp.rating;
      ratingCount++;
    }
  }

  const highestStagePerFood: Record<string, ExposureStage> = {};
  const stageCounts: Record<string, number> = {};
  for (const [foodId, bucket] of exposuresByFood) {
    const highest = getHighestStage(bucket);
    if (!highest) continue;
    highestStagePerFood[foodId] = highest;
    stageCounts[highest] = (stageCounts[highest] || 0) + 1;
  }

  const categoryCounts: Record<string, number> = {};
  for (const food of foods) {
    categoryCounts[food.category] = (categoryCounts[food.category] || 0) + 1;
  }

  const weekAgo = now - WEEK_MS;
  const weeklyExposures = exposures.filter((e) => {
    const ts = e.occurredAt instanceof Date ? e.occurredAt.getTime() : e.occurredAt;
    return ts > weekAgo;
  }).length;

  const foodProgress: FoodProgressRow[] = foods
    .map((food) => {
      const count = exposureCountPerFood[food.id] || 0;
      const { current, threshold, pct, reached } = calcExposureProgress(count, profile);
      return {
        foodId: food.id,
        foodName: food.name,
        category: food.category,
        current,
        threshold,
        pct,
        reached,
      };
    })
    .filter((row) => row.current > 0)
    .sort((a, b) => b.pct - a.pct || b.current - a.current);

  const foodsNearTarget = foodProgress.filter(
    (r) => !r.reached && r.pct >= NEAR_TARGET_PCT,
  ).length;

  return {
    // "Foods Tried" — any food with at least one exposure, regardless of
    // whether the stage strings were valid. This is independent from stageCounts,
    // which gates on getHighestStage and so drops foods whose every exposure
    // carries an unknown stage.
    totalFoods: Object.keys(exposureCountPerFood).length,
    totalExposures: exposures.length,
    safeFoods: foods.filter((f) => f.isSafeFood).length,
    stageCounts,
    categoryCounts,
    weeklyExposures,
    avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
    foodsNearTarget,
    foodProgress,
  };
}

const EARLY_EXPOSURES = 10;
const FALLBACK_THRESHOLD = 15;

export function getEncouragementMessage(stats: ProgressStats): string {
  if (stats.totalExposures === 0) {
    return 'Every journey begins with a single step. Start logging exposures today!';
  }
  if (stats.totalExposures < EARLY_EXPOSURES) {
    return 'Great start! Keep going — consistency is key to helping little tongues learn.';
  }
  if (stats.foodsNearTarget > 0) {
    const threshold = stats.foodProgress[0]?.threshold ?? FALLBACK_THRESHOLD;
    return `${stats.foodsNearTarget} food(s) are getting close to the ${threshold}-exposure target!`;
  }
  return 'Amazing progress! Your consistency is making a real difference.';
}
