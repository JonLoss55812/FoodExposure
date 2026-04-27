import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { StageIndicator, ProgressBar, ExposureCard, EmptyState, Button } from '@/src/components';
import { useChildStore } from '@/src/stores/child-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { CATEGORY_CONFIG, STAGE_CONFIG, TARGET_EXPOSURES } from '@/src/lib/constants';
import type { FoodCategory, ExposureStage } from '@/src/lib/constants';
import { getNextStage, canBumpStage, getHighestStage } from '@/src/lib/stage';
import { generateId } from '@/src/lib/utils';

export default function FoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedChildId } = useChildStore();
  const { userId } = useAuthStore();
  const [food, setFood] = useState<typeof schema.foods.$inferSelect | null>(null);
  const [exposuresList, setExposuresList] = useState<any[]>([]);
  const [highestStage, setHighestStage] = useState<ExposureStage | null>(null);
  const [bumping, setBumping] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const foodResult = await db.select().from(schema.foods).where(eq(schema.foods.id, id));
      setFood(foodResult[0] ?? null);

      if (selectedChildId) {
        const exps = await db.select({
          id: schema.exposures.id,
          stage: schema.exposures.stage,
          rating: schema.exposures.rating,
          notes: schema.exposures.notes,
          occurredAt: schema.exposures.occurredAt,
          mealType: schema.exposures.mealType,
        })
          .from(schema.exposures)
          .where(and(
            eq(schema.exposures.foodId, id),
            eq(schema.exposures.childId, selectedChildId)
          ))
          .orderBy(desc(schema.exposures.occurredAt));

        setExposuresList(exps);
        setHighestStage(getHighestStage(exps));
      }
    } finally {
      setLoading(false);
    }
  }, [id, selectedChildId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBumpStage = async () => {
    if (!id || !selectedChildId || bumping) return;
    const next = getNextStage(highestStage);
    if (!next) return;

    setBumping(true);
    try {
      await db.insert(schema.exposures).values({
        id: generateId(),
        childId: selectedChildId,
        foodId: id,
        stage: next,
        rating: null,
        preparation: null,
        temperature: null,
        texture: null,
        mealType: null,
        setting: null,
        notes: null,
        loggedBy: userId,
        occurredAt: new Date(),
        createdAt: new Date(),
      });
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to bump stage. Please try again.');
    } finally {
      setBumping(false);
    }
  };

  const handleToggleSafeFood = async () => {
    if (!food) return;
    const next = !food.isSafeFood;
    try {
      await db.update(schema.foods)
        .set({ isSafeFood: next })
        .where(eq(schema.foods.id, food.id));
      setFood({ ...food, isSafeFood: next });
    } catch (err) {
      Alert.alert('Error', 'Failed to update safe-food status.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
        </View>
        <EmptyState
          icon="🤔"
          title="Food Not Found"
          description="This food may have been deleted. Try going back to the foods list."
          actionLabel="Go to Foods"
          onAction={() => router.replace('/(tabs)/foods' as any)}
        />
      </View>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[food.category as FoodCategory];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
      </View>

      {/* Food Info */}
      <View style={styles.foodHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
          <Text style={{ fontSize: 40 }}>{categoryConfig.icon}</Text>
        </View>
        <Text style={styles.foodName}>{food.name}</Text>
        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: categoryConfig.color + '20' }]}>
            <Text style={[styles.tagText, { color: categoryConfig.color }]}>{categoryConfig.label}</Text>
          </View>
          {food.isSafeFood && (
            <View style={[styles.tag, { backgroundColor: '#22C55E20' }]}>
              <Text style={[styles.tagText, { color: '#22C55E' }]}>Safe Food</Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressCard}>
          <StageIndicator currentStage={highestStage ?? undefined} size="md" />
          <ProgressBar
            current={exposuresList.length}
            target={TARGET_EXPOSURES}
            color={highestStage ? STAGE_CONFIG[highestStage].color : '#F97316'}
          />
        </View>
      </View>

      {/* Quick Log */}
      <View style={styles.section}>
        {canBumpStage(highestStage) && (
          <Button
            label={`Bump to ${STAGE_CONFIG[getNextStage(highestStage)!].label}`}
            onPress={handleBumpStage}
            loading={bumping}
            fullWidth
            icon="⬆️"
          />
        )}
        <Button
          label="Log Detailed Exposure"
          onPress={() => router.push('/(tabs)/log')}
          fullWidth
          variant={canBumpStage(highestStage) ? 'secondary' : 'primary'}
          icon="➕"
        />
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Mark as safe food"
          accessibilityState={{ checked: !!food.isSafeFood }}
          style={[styles.safeToggle, food.isSafeFood && styles.safeToggleActive]}
          onPress={handleToggleSafeFood}
        >
          <Text style={styles.safeIcon}>{food.isSafeFood ? '⭐' : '☆'}</Text>
          <View style={styles.safeInfo}>
            <Text style={styles.safeToggleTitle}>
              {food.isSafeFood ? 'Safe Food' : 'Mark as Safe Food'}
            </Text>
            <Text style={styles.safeToggleDesc}>
              {food.isSafeFood
                ? 'Pinned to the top of the Foods tab'
                : 'A food your child already accepts'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Exposure History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exposure History ({exposuresList.length})</Text>
        {exposuresList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No exposures yet for this food.</Text>
          </View>
        ) : (
          exposuresList.map((exp) => (
            <ExposureCard
              key={exp.id}
              foodName={food.name}
              childName=""
              stage={exp.stage as ExposureStage}
              rating={exp.rating ?? undefined}
              notes={exp.notes ?? undefined}
              occurredAt={new Date(exp.occurredAt)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: theme.spacing.xxl * 2,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 60,
  },
  back: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  foodHeader: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  categoryBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodName: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  tags: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tag: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  tagText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
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
  progressCard: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
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
  },
  safeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  safeToggleActive: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '10',
  },
  safeIcon: {
    fontSize: 24,
  },
  safeInfo: {
    flex: 1,
    gap: 2,
  },
  safeToggleTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  safeToggleDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
}));
