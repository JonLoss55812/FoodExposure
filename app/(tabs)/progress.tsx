import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { ProgressBar, EmptyState } from '@/src/components';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { STAGE_ORDER, STAGE_CONFIG, FOOD_CATEGORIES, CATEGORY_CONFIG } from '@/src/lib/constants';
import { useSettingsStore } from '@/src/stores/settings-store';
import { getFeedingProfileConfig, getThresholdForProfile } from '@/src/lib/thresholds';
import { calcProgressStats, getEncouragementMessage, type ProgressStats } from '@/src/lib/progress-stats';

const EMPTY_STATS: ProgressStats = {
  totalFoods: 0,
  totalExposures: 0,
  safeFoods: 0,
  stageCounts: {},
  categoryCounts: {},
  weeklyExposures: 0,
  avgRating: 0,
  foodsNearTarget: 0,
  foodProgress: [],
};

export default function ProgressScreen() {
  const router = useRouter();
  const { familyId } = useAuthStore();
  const { selectedChildId } = useChildStore();
  const { feedingProfile } = useSettingsStore();
  const [stats, setStats] = useState<ProgressStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      setStats(calcProgressStats(allFoods, allExposures, feedingProfile));
    } catch (err) {
      console.error('Failed to load progress stats:', err);
      Alert.alert('Error', 'Failed to load progress data. Please try again.');
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
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="📊"
          title="Select a Child"
          description="Pick a child on the dashboard to view their progress."
          actionLabel="Go to Dashboard"
          onAction={() => router.push('/(tabs)' as any)}
        />
      </SafeAreaView>
    );
  }

  if (stats.totalExposures === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="📊"
          title="No Progress Yet"
          description="Log your first food exposure to see progress charts and stage distribution."
          actionLabel="Log Exposure"
          onAction={() => router.push('/(tabs)/log')}
        />
      </SafeAreaView>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
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
              accessibilityLabel="Average acceptance rating"
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
              {getFeedingProfileConfig(feedingProfile).label} · {getThresholdForProfile(feedingProfile)}
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
                accessibilityLabel={`${row.foodName} exposures progress`}
              />
            </View>
          ))}
          {stats.foodProgress.length > 10 && (
            <Text style={styles.truncationNote}>
              Showing top 10 of {stats.foodProgress.length}
            </Text>
          )}
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
                  accessibilityLabel={`${config.label} stage food count`}
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
          {getEncouragementMessage(stats, feedingProfile)}
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
  truncationNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
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
