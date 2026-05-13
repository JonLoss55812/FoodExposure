import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { ChildSelector, ExposureCard, EmptyState } from '@/src/components';
import { useChildStore } from '@/src/stores/child-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { STAGE_ORDER, STAGE_CONFIG } from '@/src/lib/constants';
import { computeStageCounts } from '@/src/lib/food-partition';
import { getStartOfDay } from '@/src/lib/utils';

type RecentExposure = {
  id: string;
  foodId: string;
  foodName: string;
  childName: string;
  stage: typeof schema.exposures.$inferSelect.stage;
  rating: number | null;
  notes: string | null;
  occurredAt: Date;
};

export default function DashboardScreen() {
  const router = useRouter();
  const { familyId, isAuthenticated, isOnboarded } = useAuthStore();
  const { selectedChildId, selectChild, ensureSelection } = useChildStore();
  const [childrenList, setChildrenList] = useState<(typeof schema.children.$inferSelect)[]>([]);
  const [recentExposures, setRecentExposures] = useState<RecentExposure[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [foodsTrackedCount, setFoodsTrackedCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!familyId) return;

    setLoading(true);
    try {
      // Load children
      const kids = await db.select().from(schema.children)
        .where(eq(schema.children.familyId, familyId));
      setChildrenList(kids);

      ensureSelection(kids);
      const childId = useChildStore.getState().selectedChildId;
      if (!childId) return;

      // Load today's exposure count. Route through canonical getStartOfDay
      // helper so the dashboard's "today" boundary stays consistent with the
      // formatRelativeDate "Today" label (which uses the same helper since
      // v0.5.49) and inherits the v0.5.114 invalid-Date defense automatically.
      const startOfDay = getStartOfDay();
      const todayExposures = await db.select().from(schema.exposures)
        .where(and(
          eq(schema.exposures.childId, childId),
          sql`${schema.exposures.occurredAt} >= ${startOfDay.getTime()}`
        ));
      setTodayCount(todayExposures.length);

      // Load recent exposures with food names
      const recent = await db.select({
        id: schema.exposures.id,
        foodId: schema.exposures.foodId,
        foodName: schema.foods.name,
        childName: schema.children.name,
        stage: schema.exposures.stage,
        rating: schema.exposures.rating,
        notes: schema.exposures.notes,
        occurredAt: schema.exposures.occurredAt,
      })
        .from(schema.exposures)
        .innerJoin(schema.foods, eq(schema.exposures.foodId, schema.foods.id))
        .innerJoin(schema.children, eq(schema.exposures.childId, schema.children.id))
        .where(eq(schema.exposures.childId, childId))
        .orderBy(desc(schema.exposures.occurredAt))
        .limit(10);
      setRecentExposures(recent);

      // Load stage distribution - count each food at its highest reached stage.
      // Delegates to computeStageCounts so this matches Foods/Progress tabs and
      // skips legacy/unknown stage strings (foods.tsx harmonization, v0.5.8).
      const allExposures = await db.select({
        foodId: schema.exposures.foodId,
        stage: schema.exposures.stage,
      })
        .from(schema.exposures)
        .where(eq(schema.exposures.childId, childId));

      setStageCounts(computeStageCounts(allExposures));
      setFoodsTrackedCount(new Set(allExposures.map((e) => e.foodId)).size);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [familyId, selectedChildId]);

  useEffect(() => {
    if (!isAuthenticated || !isOnboarded) {
      router.replace('/onboarding');
      return;
    }
    loadData();
  }, [isAuthenticated, isOnboarded, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!isAuthenticated || !isOnboarded) return null;

  if (loading && childrenList.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F97316" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const stageDistributionTotal = Object.values(stageCounts).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.tagline}>So Your Tongue Can Learn</Text>
          <Text style={styles.title}>TongueTutor</Text>
        </View>
      </View>

      {/* Child Selector */}
      <ChildSelector
        children={childrenList.map((c) => ({ id: c.id, name: c.name, avatarEmoji: c.avatarEmoji }))}
        selectedId={selectedChildId}
        onSelect={selectChild}
      />

      {childrenList.length === 0 ? (
        <EmptyState
          icon="👶"
          title="Add Your First Child"
          description="Start tracking food exposures by adding a child profile."
          actionLabel="Add Child"
          onAction={() => router.push('/child/add')}
        />
      ) : (
        <>
          {/* Today's Summary */}
          <View style={styles.summaryRow}>
            <View
              style={styles.summaryCard}
              accessibilityRole="text"
              accessibilityLabel={`Today's Exposures: ${todayCount}`}
            >
              <Text style={styles.summaryNumber}>{todayCount}</Text>
              <Text style={styles.summaryLabel}>Today's{'\n'}Exposures</Text>
            </View>
            <View
              style={styles.summaryCard}
              accessibilityRole="text"
              accessibilityLabel={`Foods Tracked: ${foodsTrackedCount}`}
            >
              <Text style={styles.summaryNumber}>{foodsTrackedCount}</Text>
              <Text style={styles.summaryLabel}>Foods{'\n'}Tracked</Text>
            </View>
            <Pressable
              style={styles.summaryCard}
              onPress={() => router.push('/(tabs)/log')}
              accessibilityRole="button"
              accessibilityLabel="Log new food exposure"
            >
              <Text style={styles.addIcon}>+</Text>
              <Text style={styles.summaryLabel}>Log{'\n'}Exposure</Text>
            </Pressable>
          </View>

          {/* Stage Distribution */}
          {stageDistributionTotal > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stage Distribution</Text>
              <View style={styles.stageGrid}>
                {STAGE_ORDER.map((stage) => {
                  const config = STAGE_CONFIG[stage];
                  const count = stageCounts[stage] || 0;
                  return (
                    <View
                      key={stage}
                      style={styles.stageItem}
                      accessibilityRole="text"
                      accessibilityLabel={`${config.label} stage: ${count} ${count === 1 ? 'food' : 'foods'}`}
                    >
                      <View style={[styles.stageDot, { backgroundColor: config.color }]}>
                        <Text style={{ fontSize: 16 }}>{config.icon}</Text>
                      </View>
                      <Text style={styles.stageCount}>{count}</Text>
                      <Text style={styles.stageLabel}>{config.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentExposures.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No exposures logged yet. Start by logging your first food exposure!</Text>
              </View>
            ) : (
              recentExposures.map((exp) => (
                <ExposureCard
                  key={exp.id}
                  foodName={exp.foodName}
                  childName={exp.childName}
                  stage={exp.stage}
                  rating={exp.rating ?? undefined}
                  notes={exp.notes ?? undefined}
                  occurredAt={new Date(exp.occurredAt)}
                  onPress={() => router.push(`/food/${exp.foodId}` as any)}
                />
              ))
            )}
          </View>
        </>
      )}
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
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 60,
    paddingBottom: theme.spacing.md,
  },
  tagline: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  summaryNumber: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  summaryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  addIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: theme.colors.primary,
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
    marginBottom: theme.spacing.xs,
  },
  stageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageItem: {
    alignItems: 'center',
    gap: 4,
  },
  stageDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCount: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  stageLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));
