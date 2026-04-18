import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { eq, and } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { StageIndicator, ProgressBar, EmptyState } from '@/src/components';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { STAGE_ORDER, STAGE_CONFIG, FOOD_CATEGORIES, CATEGORY_CONFIG } from '@/src/lib/constants';
import type { ExposureStage } from '@/src/lib/constants';
import { useSettingsStore } from '@/src/stores/settings-store';
import { calcExposureProgress, FEEDING_PROFILE_CONFIG } from '@/src/lib/thresholds';

interface FoodProgressRow {
  foodId: string;
  foodName: string;
  category: string;
  current: number;
  threshold: number;
  pct: number;
  reached: boolean;
}

export default function ProgressScreen() {
  const { familyId } = useAuthStore();
  const { selectedChildId } = useChildStore();
  const { feedingProfile } = useSettingsStore();
  const [stats, setStats] = useState({
    totalFoods: 0,
    totalExposures: 0,
    safeFoods: 0,
    stageCounts: {} as Record<string, number>,
    categoryCounts: {} as Record<string, number>,
    weeklyExposures: 0,
    avgRating: 0,
    foodsNearTarget: 0,
    foodProgress: [] as FoodProgressRow[],
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!familyId || !selectedChildId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
    const allFoods = await db.select().from(schema.foods)
      .where(eq(schema.foods.familyId, familyId));

    const allExposures = await db.select().from(schema.exposures)
      .where(eq(schema.exposures.childId, selectedChildId));

    // Stage distribution (highest stage per food)
    const highestStagePerFood: Record<string, ExposureStage> = {};
    const exposureCountPerFood: Record<string, number> = {};
    let totalRating = 0;
    let ratingCount = 0;

    for (const exp of allExposures) {
      const stage = exp.stage as ExposureStage;
      const foodId = exp.foodId;

      exposureCountPerFood[foodId] = (exposureCountPerFood[foodId] || 0) + 1;

      if (!highestStagePerFood[foodId] || STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(highestStagePerFood[foodId])) {
        highestStagePerFood[foodId] = stage;
      }

      if (exp.rating) {
        totalRating += exp.rating;
        ratingCount++;
      }
    }

    const stageCounts: Record<string, number> = {};
    for (const stage of Object.values(highestStagePerFood)) {
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }

    // Category distribution
    const categoryCounts: Record<string, number> = {};
    for (const food of allFoods) {
      categoryCounts[food.category] = (categoryCounts[food.category] || 0) + 1;
    }

    // Weekly exposures
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyExposures = allExposures.filter(
      (e) => (e.occurredAt instanceof Date ? e.occurredAt.getTime() : e.occurredAt) > weekAgo
    ).length;

    // Per-food progress vs threshold (based on feeding profile)
    const foodProgress: FoodProgressRow[] = allFoods
      .map((food) => {
        const count = exposureCountPerFood[food.id] || 0;
        const { current, threshold, pct, reached } = calcExposureProgress(count, feedingProfile);
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
      (r) => !r.reached && r.pct >= 0.8
    ).length;

    setStats({
      totalFoods: Object.keys(highestStagePerFood).length,
      totalExposures: allExposures.length,
      safeFoods: allFoods.filter((f) => f.isSafeFood).length,
      stageCounts,
      categoryCounts,
      weeklyExposures,
      avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
      foodsNearTarget,
      foodProgress,
    });
    } catch (err) {
      console.error('Failed to load progress stats:', err);
    } finally {
      setLoading(false);
    }
  }, [familyId, selectedChildId, feedingProfile]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F97316" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!selectedChildId) {
    return (
      <EmptyState
        icon="📊"
        title="Select a Child"
        description="Go to the dashboard and select a child to view their progress."
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>Track your journey</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalExposures}</Text>
          <Text style={styles.statLabel}>Total Exposures</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalFoods}</Text>
          <Text style={styles.statLabel}>Foods Tried</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.weeklyExposures}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {/* Average Rating */}
      {stats.avgRating > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Average Acceptance</Text>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingNumber}>{stats.avgRating.toFixed(1)}</Text>
            <Text style={styles.ratingLabel}>/5</Text>
            <ProgressBar
              current={stats.avgRating}
              target={5}
              color="#F97316"
              showLabel={false}
              height={10}
            />
          </View>
        </View>
      )}

      {/* Per-food Exposure Progress */}
      {stats.foodProgress.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Exposures Toward Acceptance</Text>
            <Text style={styles.profileTag}>
              {FEEDING_PROFILE_CONFIG[feedingProfile].label} · {stats.foodProgress[0]?.threshold ?? 15}
            </Text>
          </View>
          {stats.foodProgress.slice(0, 10).map((row) => (
            <View key={row.foodId} style={styles.foodProgressRow}>
              <View style={styles.foodProgressHeader}>
                <Text style={styles.foodProgressName} numberOfLines={1}>
                  {row.reached ? '✓ ' : ''}{row.foodName}
                </Text>
                <Text style={styles.foodProgressCount}>
                  {row.current}/{row.threshold}
                </Text>
              </View>
              <ProgressBar
                current={row.current}
                target={row.threshold}
                color={row.reached ? '#34D399' : '#F97316'}
                showLabel={false}
                height={8}
              />
            </View>
          ))}
        </View>
      )}

      {/* Stage Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stage Distribution</Text>
        {STAGE_ORDER.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const count = stats.stageCounts[stage] || 0;
          return (
            <View key={stage} style={styles.stageRow}>
              <View style={styles.stageInfo}>
                <Text style={{ fontSize: 16 }}>{config.icon}</Text>
                <Text style={styles.stageLabel}>{config.label}</Text>
              </View>
              <View style={styles.stageBarContainer}>
                <ProgressBar
                  current={count}
                  target={Math.max(stats.totalFoods, 1)}
                  color={config.color}
                  showLabel={false}
                  height={8}
                />
              </View>
              <Text style={styles.stageCount}>{count}</Text>
            </View>
          );
        })}
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Food Categories</Text>
        <View style={styles.categoryGrid}>
          {FOOD_CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const count = stats.categoryCounts[cat] || 0;
            return (
              <View key={cat} style={styles.categoryCard}>
                <Text style={{ fontSize: 24 }}>{config.icon}</Text>
                <Text style={styles.categoryCount}>{count}</Text>
                <Text style={styles.categoryLabel}>{config.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Encouragement */}
      <View style={styles.encouragement}>
        <Text style={styles.encouragementText}>
          {stats.totalExposures === 0
            ? "Every journey begins with a single step. Start logging exposures today!"
            : stats.totalExposures < 10
            ? "Great start! Keep going — consistency is key to helping little tongues learn."
            : stats.foodsNearTarget > 0
            ? `${stats.foodsNearTarget} food(s) are getting close to the ${stats.foodProgress[0]?.threshold ?? 15}-exposure target!`
            : "Amazing progress! Your consistency is making a real difference."}
        </Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingBottom: theme.spacing.xxl * 2,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 60,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  statNumber: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileTag: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  foodProgressRow: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  foodProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodProgressName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  foodProgressCount: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  ratingCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  ratingNumber: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  ratingLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    width: 90,
  },
  stageLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
  },
  stageBarContainer: {
    flex: 1,
  },
  stageCount: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    width: 24,
    textAlign: 'right',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryCard: {
    width: '30%',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  categoryCount: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  categoryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  encouragement: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  encouragementText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
}));
