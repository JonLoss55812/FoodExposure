import { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { FoodCard, EmptyState } from '@/src/components';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { FOOD_CATEGORIES, CATEGORY_CONFIG, getCategoryConfig } from '@/src/lib/constants';
import type { FoodCategory, ExposureStage } from '@/src/lib/constants';
import { partitionSafeFoods, getEmptyStateKind, buildFoodsWithStats, filterFoods, findDuplicateFoodGroups } from '@/src/lib/food-partition';
import { mergeFoods } from '@/src/lib/merge-foods';
import { createInFlightLatch } from '@/src/lib/in-flight';

// A render error here stays inside this screen, keeping the navigator (tab bar,
// modal dismiss) usable; see app/__tests__/route-error-boundaries.test.tsx.
export { RouteErrorBoundary as ErrorBoundary } from '@/src/components/RouteErrorBoundary';

type FoodWithStats = typeof schema.foods.$inferSelect & {
  exposureCount: number;
  highestStage?: ExposureStage;
};

export default function FoodsScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { familyId } = useAuthStore();
  const { selectedChildId } = useChildStore();
  const [foods, setFoods] = useState<FoodWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const mergeLatch = useRef(createInFlightLatch()).current;

  const loadFoods = useCallback(async () => {
    if (!familyId) return;

    if (!hasLoadedRef.current) setLoading(true);
    try {
      // Load all foods
      const allFoods = await db.select().from(schema.foods)
        .where(eq(schema.foods.familyId, familyId))
        .orderBy(asc(schema.foods.name));

      // Load ALL exposures for selected child in one query
      let allExposures: (typeof schema.exposures.$inferSelect)[] = [];
      if (selectedChildId) {
        allExposures = await db.select().from(schema.exposures)
          .where(eq(schema.exposures.childId, selectedChildId));
      }

      setFoods(buildFoodsWithStats(allFoods, allExposures));
    } catch (err) {
      console.error('Failed to load foods:', err);
      Alert.alert('Error', 'Failed to load foods. Please try again.');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [familyId, selectedChildId]);

  useFocusEffect(
    useCallback(() => {
      loadFoods();
    }, [loadFoods])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFoods();
    setRefreshing(false);
  }, [loadFoods]);

  const filteredFoods = filterFoods(foods, searchQuery, selectedCategory);

  const { safeFoods, otherFoods } = partitionSafeFoods(filteredFoods);

  /**
   * Duplicates are a property of the *library*, not of the current filter, so
   * this reads `foods` rather than `filteredFoods` — a parent who has typed a
   * search that hides one of the twins must not be told the problem went away.
   * Only the first group is offered at a time: merging is destructive to one
   * row, and a queue of confirm dialogs is the wrong shape for it. The banner
   * simply reappears while any duplicate remains.
   */
  const duplicateGroups = findDuplicateFoodGroups(foods);
  const duplicateGroup = duplicateGroups[0];

  /**
   * The survivor is the group's first member, which is its first row in the
   * `asc(name)` load order. Every member of a group normalizes to the same
   * name, so they differ only in casing or padding — which makes "which
   * spelling survives" genuinely low-stakes, and the name is editable in place
   * afterwards either way. The latch is acquired inside the confirm callback,
   * never in the function that opens the Alert (the v0.5.144 placement rule):
   * acquiring at the top would strand it the moment the parent taps Cancel.
   */
  const handleMergeDuplicates = () => {
    if (!duplicateGroup || mergeLatch.busy) return;
    const [target, source] = duplicateGroup;
    Alert.alert(
      'Merge Duplicates?',
      `"${source.name}" and "${target.name}" are the same food. Every exposure logged against "${source.name}" will move to "${target.name}", and "${source.name}" will be removed. Nothing is lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: async () => {
            if (!mergeLatch.tryAcquire()) return;
            try {
              await mergeFoods(db, source.id, target.id);
              await loadFoods();
            } catch (err) {
              console.error('Failed to merge duplicate foods:', err);
              Alert.alert('Error', 'Failed to merge foods. Please try again.');
            } finally {
              mergeLatch.release();
            }
          },
        },
      ]
    );
  };

  const renderFoodItem = useCallback(({ item }: { item: FoodWithStats }) => (
    <View style={styles.cardWrapper}>
      <FoodCard
        name={item.name}
        category={item.category}
        currentStage={item.highestStage}
        exposureCount={item.exposureCount}
        isSafeFood={!!item.isSafeFood}
        onPress={() => router.push(`/food/${item.id}`)}
      />
    </View>
  ), [router]);

  const SafeFoodsSection = safeFoods.length > 0 ? (
    <View style={styles.safeSection} testID="safe-foods-section">
      <View style={styles.safeHeader}>
        <Text style={styles.safeTitle}>⭐ Safe Foods</Text>
        <Text style={styles.safeSubtitle}>{safeFoods.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.safeScroll}
      >
        {safeFoods.map((item) => (
          <Pressable
            key={item.id}
            style={styles.safeChip}
            onPress={() => router.push(`/food/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name} details`}
          >
            <Text style={styles.safeChipIcon}>{getCategoryConfig(item.category).icon}</Text>
            <Text style={styles.safeChipName} numberOfLines={1}>{item.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;

  if (loading && foods.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Foods</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/food/add')}
          accessibilityRole="button"
          accessibilityLabel="Add new food"
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {duplicateGroup ? (
        <View style={styles.duplicateBanner} testID="duplicate-banner">
          <Text style={styles.duplicateText}>
            {`"${duplicateGroup[0].name}" is in your library ${duplicateGroup.length} times. Merging keeps every logged exposure.`}
          </Text>
          <Pressable
            style={styles.duplicateAction}
            onPress={handleMergeDuplicates}
            accessibilityRole="button"
            accessibilityLabel={`Merge duplicates of ${duplicateGroup[0].name}`}
          >
            <Text style={styles.duplicateActionText}>Merge</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search foods..."
          placeholderTextColor="#94A3B8"
          accessibilityLabel="Search foods"
        />
      </View>

      {/* Category Filter */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipSelected]}
          onPress={() => setSelectedCategory('all')}
          accessibilityRole="button"
          accessibilityLabel="Filter by all categories"
          accessibilityState={{ selected: selectedCategory === 'all' }}
        >
          <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextSelected]}>All</Text>
        </Pressable>
        {FOOD_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipSelected]}
            onPress={() => setSelectedCategory(cat)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${CATEGORY_CONFIG[cat].label}`}
            accessibilityState={{ selected: selectedCategory === cat }}
          >
            <Text style={{ fontSize: 14 }}>{CATEGORY_CONFIG[cat].icon}</Text>
            <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextSelected]}>
              {CATEGORY_CONFIG[cat].label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Food List */}
      {(() => {
        const kind = getEmptyStateKind(foods.length, filteredFoods.length);
        if (kind === 'none') {
          return (
            <EmptyState
              icon="🍽️"
              title="No Foods Yet"
              description="Add foods to your library to start tracking exposures."
              actionLabel="Add Food"
              onAction={() => router.push('/food/add')}
            />
          );
        }
        if (kind === 'filtered') {
          return (
            <EmptyState
              icon="🔎"
              title="No Matches"
              description="No foods match your search or category filter."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            />
          );
        }
        return (
          <FlashList
            data={otherFoods}
            renderItem={renderFoodItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            ListHeaderComponent={SafeFoodsSection}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: 60,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  addButton: {
    backgroundColor: theme.colors.primaryStrong,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  addButtonText: {
    color: theme.colors.onPrimaryStrong,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  searchInput: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm + 4,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  filterText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterTextSelected: {
    color: theme.colors.primaryStrong,
    fontWeight: '700',
  },
  cardWrapper: {
    marginBottom: theme.spacing.sm,
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
  },
  duplicateText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  duplicateAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  duplicateActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primaryStrong,
  },
  safeSection: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.success + '10',
  },
  safeHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  safeTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  safeSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  safeScroll: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  safeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.sm - 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 1,
    borderColor: theme.colors.success + '40',
    maxWidth: 160,
  },
  safeChipIcon: {
    fontSize: 16,
  },
  safeChipName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
  },
}));
