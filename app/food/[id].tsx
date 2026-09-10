import { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { StageIndicator, ProgressBar, ExposureCard, EmptyState, Button } from '@/src/components';
import { useChildStore } from '@/src/stores/child-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { useSettingsStore } from '@/src/stores/settings-store';
import { STAGE_CONFIG, STAGE_ORDER, CATEGORY_CONFIG, FOOD_CATEGORIES, PREPARATIONS, getCategoryConfig } from '@/src/lib/constants';
import type { ExposureStage, FoodCategory } from '@/src/lib/constants';
import { getNextStage, canBumpStage, getHighestStage } from '@/src/lib/stage';
import { getThresholdForProfile } from '@/src/lib/thresholds';
import { generateId, formatDate } from '@/src/lib/utils';
import { deleteFoodCascade } from '@/src/lib/cascade-delete';
import { findDuplicateFood } from '@/src/lib/food-partition';
import { foodSchema } from '@/src/lib/validation';
import { createInFlightLatch } from '@/src/lib/in-flight';

type ExposureRow = Pick<
  typeof schema.exposures.$inferSelect,
  'id' | 'stage' | 'rating' | 'notes' | 'occurredAt' | 'mealType' | 'temperature' | 'texture' | 'setting'
>;

/** PREPARATIONS are stored lowercase; every surface displays them title-cased. */
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function FoodDetailScreen() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedChildId } = useChildStore();
  const { userId } = useAuthStore();
  const { feedingProfile } = useSettingsStore();
  const [food, setFood] = useState<typeof schema.foods.$inferSelect | null>(null);
  const [exposuresList, setExposuresList] = useState<ExposureRow[]>([]);
  const [highestStage, setHighestStage] = useState<ExposureStage | null>(null);
  const [bumping, setBumping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingPrep, setEditingPrep] = useState(false);
  const [savingPrep, setSavingPrep] = useState(false);
  const [deletingExposureId, setDeletingExposureId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [loading, setLoading] = useState(true);
  // `bumping`/`deleting` lag a render behind the tap; the latches are synchronous.
  const bumpLatch = useRef(createInFlightLatch()).current;
  const deleteLatch = useRef(createInFlightLatch()).current;
  const renameLatch = useRef(createInFlightLatch()).current;
  const categoryLatch = useRef(createInFlightLatch()).current;
  const prepLatch = useRef(createInFlightLatch()).current;
  const exposureLatch = useRef(createInFlightLatch()).current;
  const stageEditLatch = useRef(createInFlightLatch()).current;

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
          temperature: schema.exposures.temperature,
          texture: schema.exposures.texture,
          setting: schema.exposures.setting,
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
    } catch (err) {
      console.error('Failed to load food detail:', err);
      Alert.alert('Error', 'Failed to load food details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, selectedChildId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBumpStage = async () => {
    if (!id || !selectedChildId) return;
    const next = getNextStage(highestStage);
    if (!next) return;
    if (!bumpLatch.tryAcquire()) return;

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
      console.error('Failed to bump stage:', err);
      Alert.alert('Error', 'Failed to bump stage. Please try again.');
    } finally {
      bumpLatch.release();
      setBumping(false);
    }
  };

  /**
   * Remove a single mis-logged exposure. Without this the only removal path is
   * the v0.5.138 Delete Food cascade, which discards every exposure for the food
   * across every child — so correcting one double-tap cost the whole history the
   * acceptance threshold is counted from.
   */
  const handleDeleteExposure = (exp: ExposureRow) => {
    if (!food || exposureLatch.busy) return;
    const when = formatDate(new Date(exp.occurredAt));
    Alert.alert(
      'Delete Exposure?',
      `This ${STAGE_CONFIG[exp.stage]?.label ?? exp.stage} exposure of ${food.name}` +
        `${when ? ` from ${when}` : ''} will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!exposureLatch.tryAcquire()) return;
            setDeletingExposureId(exp.id);
            try {
              await db.delete(schema.exposures).where(eq(schema.exposures.id, exp.id));
              // Patch locally rather than reloading — this screen loads in a
              // useEffect, not on focus. Recomputing the highest stage is the
              // load-bearing half: deleting the row that established it must
              // move the "Bump to X" target back down.
              const remaining = exposuresList.filter((row) => row.id !== exp.id);
              setExposuresList(remaining);
              setHighestStage(getHighestStage(remaining));
            } catch (err) {
              console.error('Failed to delete exposure:', err);
              Alert.alert('Error', 'Failed to delete exposure. Please try again.');
            } finally {
              exposureLatch.release();
              setDeletingExposureId(null);
            }
          },
        },
      ]
    );
  };

  /**
   * Correct a logged exposure's stage in place.
   *
   * v0.5.163 made an exposure deletable but not editable, so fixing a
   * mis-tapped stage meant delete-and-re-log — which discards the row's
   * original `createdAt` and every optional dimension the parent recorded
   * with it (rating, notes, meal, temperature, texture, setting). Stage is
   * the field that most needs correcting: it is what `getHighestStage`
   * reads, so one wrong tap can fix the food's highest reached level at a
   * stage the child never actually reached, which then drives the
   * "Bump to X" target and the dashboard's stage distribution.
   *
   * Same shape as the v0.5.160 category editor — stage is a closed enum, so
   * picking a chip *is* the commit and there is no separate Save step, and
   * re-picking the current stage is a no-op that just closes the row. Unlike
   * the v0.5.161 preparation editor there is no clear-on-re-tap: `stage` is
   * NOT NULL, so "unset" is not a legal persisted state.
   */
  const handleSelectExposureStage = async (exp: ExposureRow, next: ExposureStage) => {
    if (!stageEditLatch.tryAcquire()) return;

    if (next === exp.stage) {
      stageEditLatch.release();
      setEditingStageId(null);
      return;
    }

    setSavingStageId(exp.id);
    try {
      await db.update(schema.exposures)
        .set({ stage: next })
        .where(eq(schema.exposures.id, exp.id));
      // Patch locally rather than reloading — this screen loads in a
      // useEffect, not on focus. Recomputing the highest stage is the
      // load-bearing half, in both directions: correcting the row that
      // established the highest stage downward must move the "Bump to X"
      // target back down, and correcting one upward must move it up.
      const updated = exposuresList.map((row) =>
        row.id === exp.id ? { ...row, stage: next } : row
      );
      setExposuresList(updated);
      setHighestStage(getHighestStage(updated));
      setEditingStageId(null);
    } catch (err) {
      console.error('Failed to change exposure stage:', err);
      Alert.alert('Error', 'Failed to change stage. Please try again.');
      // Leave the row open so the retry is one tap rather than a re-open.
    } finally {
      stageEditLatch.release();
      setSavingStageId(null);
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
      console.error('Failed to toggle safe food:', err);
      Alert.alert('Error', 'Failed to update safe-food status.');
    }
  };

  const startEditingName = () => {
    if (!food) return;
    setNameDraft(food.name);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!food || !renameLatch.tryAcquire()) return;

    // The schema owns trim/min/max; reuse it so rename and Add Food agree.
    const parsed = foodSchema.shape.name.safeParse(nameDraft);
    if (!parsed.success) {
      renameLatch.release();
      Alert.alert('Invalid Name', parsed.error.issues[0]?.message ?? 'Please enter a food name.');
      return;
    }
    const nextName = parsed.data;
    if (nextName === food.name) {
      renameLatch.release();
      setEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      // Rename must not bypass the v0.5.136 uniqueness guard — but the food
      // being renamed is excluded so a case-only fix ("apple" -> "Apple") works.
      const siblings = await db
        .select({ id: schema.foods.id, name: schema.foods.name })
        .from(schema.foods)
        .where(eq(schema.foods.familyId, food.familyId));
      const duplicate = findDuplicateFood(siblings, nextName, food.id);
      if (duplicate) {
        Alert.alert(
          'Already Added',
          `"${duplicate.name}" is already in your food library. Pick a different name.`,
        );
        return;
      }

      await db.update(schema.foods)
        .set({ name: nextName })
        .where(eq(schema.foods.id, food.id));
      setFood({ ...food, name: nextName });
      setEditingName(false);
    } catch (err) {
      console.error('Failed to rename food:', err);
      Alert.alert('Error', 'Failed to rename food. Please try again.');
    } finally {
      renameLatch.release();
      setSavingName(false);
    }
  };

  /**
   * Persist a new category. Until now the only way to fix a mis-tapped
   * category was Delete Food + re-add, which discards every logged exposure
   * for the food across every child — so a one-tap mistake on Add Food cost
   * the exposure history that the acceptance threshold is counted from.
   *
   * Category is a closed enum, so there is no uniqueness guard to respect
   * (unlike the rename path) and no separate Save step: picking a chip is the
   * commit. Picking the current category is a no-op that just closes the row.
   */
  const handleSelectCategory = async (next: FoodCategory) => {
    if (!food || !categoryLatch.tryAcquire()) return;

    if (next === food.category) {
      categoryLatch.release();
      setEditingCategory(false);
      return;
    }

    setSavingCategory(true);
    try {
      await db.update(schema.foods)
        .set({ category: next })
        .where(eq(schema.foods.id, food.id));
      setFood({ ...food, category: next });
      setEditingCategory(false);
    } catch (err) {
      console.error('Failed to change food category:', err);
      Alert.alert('Error', 'Failed to change category. Please try again.');
    } finally {
      categoryLatch.release();
      setSavingCategory(false);
    }
  };

  /**
   * Persist a new default preparation. Same shape as the category editor —
   * closed suggestion list, so picking a chip is the commit — with one
   * deliberate difference: `defaultPreparation` is nullable, so "not
   * recorded" is a legal persisted state and has to stay reachable. Re-tapping
   * the selected chip therefore *clears* the field rather than being a no-op,
   * matching the v0.5.137 optional-chip deselect contract. Without that a
   * mis-tap here would be permanent-or-destructive all over again, which is
   * the exact defect this closes.
   */
  const handleSelectPreparation = async (next: string) => {
    if (!food || !prepLatch.tryAcquire()) return;

    const value = next === food.defaultPreparation ? null : next;

    setSavingPrep(true);
    try {
      await db.update(schema.foods)
        .set({ defaultPreparation: value })
        .where(eq(schema.foods.id, food.id));
      setFood({ ...food, defaultPreparation: value });
      setEditingPrep(false);
    } catch (err) {
      console.error('Failed to change default preparation:', err);
      Alert.alert('Error', 'Failed to change preparation. Please try again.');
    } finally {
      prepLatch.release();
      setSavingPrep(false);
    }
  };

  const handleDeleteFood = () => {
    if (!food || deleting) return;
    Alert.alert(
      'Delete Food?',
      `"${food.name}" and all of its logged exposures for every child will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!deleteLatch.tryAcquire()) return;
            setDeleting(true);
            try {
              await deleteFoodCascade(db, food.id);
              router.replace('/(tabs)/foods' as any);
            } catch (err) {
              console.error('Failed to delete food:', err);
              Alert.alert('Error', 'Failed to delete food. Please try again.');
              deleteLatch.release();
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
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

  const categoryConfig = getCategoryConfig(food.category);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>Back</Text>
        </Pressable>
      </View>

      {/* Food Info */}
      <View style={styles.foodHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
          <Text style={{ fontSize: 40 }}>{categoryConfig.icon}</Text>
        </View>
        {editingName ? (
          <View style={styles.renameRow}>
            <TextInput
              style={styles.renameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              maxLength={80}
              accessibilityLabel="Food name"
              placeholder="Food name"
            />
            <Pressable
              onPress={handleSaveName}
              disabled={savingName}
              accessibilityRole="button"
              accessibilityLabel="Save food name"
              accessibilityState={{ disabled: savingName, busy: savingName }}
            >
              <Text style={styles.renameAction}>{savingName ? 'Saving…' : 'Save'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditingName(false)}
              disabled={savingName}
              accessibilityRole="button"
              accessibilityLabel="Cancel renaming food"
            >
              <Text style={styles.renameCancel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={startEditingName}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${food.name}`}
          >
            <Text style={styles.foodName}>{food.name} <Text style={styles.editHint}>✏️</Text></Text>
          </Pressable>
        )}
        <View style={styles.tags}>
          <Pressable
            onPress={() => setEditingCategory((open) => !open)}
            style={[styles.tag, { backgroundColor: categoryConfig.color + '20' }]}
            accessibilityRole="button"
            accessibilityLabel={`Change category, currently ${categoryConfig.label}`}
            accessibilityState={{ expanded: editingCategory }}
          >
            <Text style={[styles.tagText, { color: categoryConfig.color }]}>
              {categoryConfig.label} <Text style={styles.editHint}>✏️</Text>
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setEditingPrep((open) => !open)}
            style={[styles.tag, styles.prepTag]}
            accessibilityRole="button"
            accessibilityLabel={
              food.defaultPreparation
                ? `Change preparation, currently ${titleCase(food.defaultPreparation)}`
                : 'Set default preparation'
            }
            accessibilityState={{ expanded: editingPrep }}
          >
            <Text style={[styles.tagText, styles.prepTagText]}>
              {food.defaultPreparation ? titleCase(food.defaultPreparation) : 'Add prep'}{' '}
              <Text style={styles.editHint}>✏️</Text>
            </Text>
          </Pressable>
          {food.isSafeFood && (
            <View style={[styles.tag, { backgroundColor: '#22C55E20' }]}>
              <Text style={[styles.tagText, { color: '#22C55E' }]}>Safe Food</Text>
            </View>
          )}
        </View>
        {editingCategory && (
          <View style={styles.editChipRow}>
            {FOOD_CATEGORIES.map((value) => {
              const config = CATEGORY_CONFIG[value];
              const isSelected = value === food.category;
              return (
                <Pressable
                  key={value}
                  style={[
                    styles.editChip,
                    isSelected && { backgroundColor: config.color + '20', borderColor: config.color },
                  ]}
                  onPress={() => handleSelectCategory(value)}
                  disabled={savingCategory}
                  accessibilityRole="button"
                  accessibilityLabel={`Category: ${config.label}`}
                  accessibilityState={{ selected: isSelected, disabled: savingCategory }}
                >
                  <Text style={styles.editChipText}>{config.icon} {config.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {editingPrep && (
          <View style={styles.editChipRow}>
            {PREPARATIONS.map((prep) => {
              const isSelected = prep === food.defaultPreparation;
              return (
                <Pressable
                  key={prep}
                  style={[styles.editChip, isSelected && styles.editChipSelected]}
                  onPress={() => handleSelectPreparation(prep)}
                  disabled={savingPrep}
                  accessibilityRole="button"
                  accessibilityLabel={`Preparation: ${titleCase(prep)}`}
                  accessibilityState={{ selected: isSelected, disabled: savingPrep }}
                >
                  <Text style={styles.editChipText}>{titleCase(prep)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressCard}>
          <StageIndicator currentStage={highestStage ?? undefined} size="md" />
          <ProgressBar
            current={exposuresList.length}
            target={getThresholdForProfile(feedingProfile)}
            color={highestStage ? STAGE_CONFIG[highestStage].color : undefined}
            accessibilityLabel={`${food.name} exposures progress`}
          />
        </View>
      </View>

      {/* Quick Log */}
      <View style={styles.section}>
        {selectedChildId && canBumpStage(highestStage) && (
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
          variant={selectedChildId && canBumpStage(highestStage) ? 'secondary' : 'primary'}
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
        {!selectedChildId ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Select a child on the dashboard to see exposure history.
            </Text>
          </View>
        ) : exposuresList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No exposures yet for this food.</Text>
          </View>
        ) : (
          exposuresList.map((exp) => (
            <View key={exp.id}>
              <ExposureCard
                foodName={food.name}
                childName=""
                stage={exp.stage}
                rating={exp.rating ?? undefined}
                notes={exp.notes ?? undefined}
                occurredAt={new Date(exp.occurredAt)}
                mealType={exp.mealType ?? undefined}
                temperature={exp.temperature ?? undefined}
                texture={exp.texture ?? undefined}
                setting={exp.setting ?? undefined}
              />
              <View style={styles.exposureActions}>
                <Pressable
                  style={styles.exposureAction}
                  onPress={() =>
                    setEditingStageId((current) => (current === exp.id ? null : exp.id))
                  }
                  disabled={deletingExposureId !== null || savingStageId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Change stage of ${STAGE_CONFIG[exp.stage]?.label ?? exp.stage} exposure from ${formatDate(new Date(exp.occurredAt))}`}
                  accessibilityState={{
                    expanded: editingStageId === exp.id,
                    disabled: deletingExposureId !== null || savingStageId !== null,
                    busy: savingStageId === exp.id,
                  }}
                >
                  <Text style={styles.exposureActionText}>
                    {savingStageId === exp.id ? 'Saving…' : 'Edit stage'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.exposureDelete}
                  onPress={() => handleDeleteExposure(exp)}
                  disabled={deletingExposureId !== null || savingStageId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${STAGE_CONFIG[exp.stage]?.label ?? exp.stage} exposure from ${formatDate(new Date(exp.occurredAt))}`}
                  accessibilityState={{
                    disabled: deletingExposureId !== null || savingStageId !== null,
                    busy: deletingExposureId === exp.id,
                  }}
                >
                  <Text style={styles.exposureDeleteText}>
                    {deletingExposureId === exp.id ? 'Deleting…' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
              {editingStageId === exp.id && (
                <View style={styles.editChipRow}>
                  {STAGE_ORDER.map((value) => {
                    const config = STAGE_CONFIG[value];
                    const isSelected = value === exp.stage;
                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.editChip,
                          isSelected && {
                            backgroundColor: config.color + '20',
                            borderColor: config.color,
                          },
                        ]}
                        onPress={() => handleSelectExposureStage(exp, value)}
                        disabled={savingStageId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Set stage: ${config.label}`}
                        accessibilityState={{
                          selected: isSelected,
                          disabled: savingStageId !== null,
                        }}
                      >
                        <Text style={styles.editChipText}>
                          {config.icon} {config.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Delete Food */}
      <View style={styles.section}>
        <Pressable
          style={styles.deleteButton}
          onPress={handleDeleteFood}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${food.name}`}
          accessibilityState={{ disabled: deleting, busy: deleting }}
        >
          <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete Food'}</Text>
        </Pressable>
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
    color: theme.colors.primaryStrong,
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
  editHint: {
    fontSize: theme.fontSize.md,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.lg,
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  renameAction: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.primaryStrong,
  },
  renameCancel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
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
  editChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  editChip: {
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  prepTag: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  prepTagText: {
    color: theme.colors.textSecondary,
  },
  editChipSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryStrong,
  },
  editChipText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
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
  exposureActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  exposureAction: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  exposureActionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primaryStrong,
  },
  exposureDelete: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  exposureDeleteText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    fontWeight: '600',
  },
  deleteButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.error + '15',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.error,
  },
}));
