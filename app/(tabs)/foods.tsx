import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { eq, and } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { FoodCard, EmptyState } from '@/src/components';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { FOOD_CATEGORIES, CATEGORY_CONFIG, STAGE_ORDER } from '@/src/lib/constants';
import type { FoodCategory, ExposureStage } from '@/src/lib/constants';

type FoodWithStats = typeof schema.foods.$inferSelect & {
  exposureCount: number;
  highestStage?: ExposureStage;
};

export default function FoodsScreen() {
  const router = useRouter();
  const { familyId } = useAuthStore();
  const { selectedChildId } = useChildStore();
  const [foods, setFoods] = useState<FoodWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const loadFoods = useCallback(async () => {
    if (!familyId) return;

    setLoading(true);
    try {
      // Load all foods
      const allFoods = await db.select().from(schema.foods)
        .where(eq(schema.foods.familyId, familyId));

      // Load ALL exposures for selected child in one query
      let allExposures: (typeof schema.exposures.$inferSelect)[] = [];
      if (selectedChildId) {
        allExposures = await db.select().from(schema.exposures)
          .where(eq(schema.exposures.childId, selectedChildId));
      }

      // Group exposures by foodId in memory
      const exposuresByFood = new Map<string, typeof allExposures>();
      for (const exp of allExposures) {
        const existing = exposuresByFood.get(exp.foodId) || [];
        existing.push(exp);
        exposuresByFood.set(exp.foodId, existing);
      }

      // Build stats from grouped data
      const foodsWithStats: FoodWithStats[] = allFoods.map((food) => {
        const foodExposures = exposuresByFood.get(food.id) || [];

        let highestStage: ExposureStage | undefined;
        for (const exp of foodExposures) {
          const stage = exp.stage as ExposureStage;
          if (!highestStage || STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(highestStage)) {
            highestStage = stage;
          }
        }

        return {
          ...food,
          exposureCount: foodExposures.length,
          highestStage,
        };
      });

      setFoods(foodsWithStats);
    } catch (err) {
      console.error('Failed to load foods:', err);
      Alert.alert('Error', 'Failed to load foods. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [familyId, selectedChildId]);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  const filteredFoods = foods.filter((food) => {
    const matchesSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || food.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderFoodItem = useCallback(({ item }: { item: FoodWithStats }) => (
    <View style={styles.cardWrapper}>
      <FoodCard
        name={item.name}
        category={item.category as FoodCategory}
        currentStage={item.highestStage}
        exposureCount={item.exposureCount}
        isSafeFood={!!item.isSafeFood}
        onPress={() => router.push(`/food/${item.id}`)}
      />
    </View>
  ), [router]);

  if (loading && foods.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F97316" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Foods</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/food/add')}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search foods..."
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Category Filter */}
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipSelected]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextSelected]}>All</Text>
        </Pressable>
        {FOOD_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipSelected]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={{ fontSize: 14 }}>{CATEGORY_CONFIG[cat].icon}</Text>
            <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextSelected]}>
              {CATEGORY_CONFIG[cat].label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Food List */}
      {filteredFoods.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title="No Foods Yet"
          description="Add foods to your library to start tracking exposures."
          actionLabel="Add Food"
          onAction={() => router.push('/food/add')}
        />
      ) : (
        <FlashList
          data={filteredFoods}
          renderItem={renderFoodItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        />
      )}
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
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
  },
  addButtonText: {
    color: theme.colors.white,
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
    color: theme.colors.primary,
    fontWeight: '700',
  },
  cardWrapper: {
    marginBottom: theme.spacing.sm,
  },
}));
