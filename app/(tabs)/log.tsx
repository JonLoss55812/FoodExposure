import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { ChildSelector, StageIndicator, RatingPicker, Button } from '@/src/components';
import { useChildStore } from '@/src/stores/child-store';
import { useAuthStore } from '@/src/stores/auth-store';
import { exposureSchema, type ExposureFormData } from '@/src/lib/validation';
import { generateId } from '@/src/lib/utils';
import { STAGE_ORDER, STAGE_CONFIG, MEAL_TYPES, TEMPERATURES, TEXTURES, SETTINGS } from '@/src/lib/constants';

export default function LogExposureScreen() {
  const router = useRouter();
  const { familyId, userId } = useAuthStore();
  const { selectedChildId, selectChild } = useChildStore();
  const [childrenList, setChildrenList] = useState<(typeof schema.children.$inferSelect)[]>([]);
  const [foodsList, setFoodsList] = useState<(typeof schema.foods.$inferSelect)[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<
    z.input<typeof exposureSchema>,
    unknown,
    ExposureFormData
  >({
    resolver: zodResolver(exposureSchema),
    defaultValues: {
      childId: selectedChildId || '',
      foodId: '',
      stage: 'tolerate',
    },
  });

  // Derive UI selection state from the form rather than holding parallel
  // useState — the form is the single source of truth, so the chip
  // highlight and validated submit value can never disagree.
  const selectedFoodId = watch('foodId');
  const selectedStage = watch('stage');

  // Keep the form's childId in sync with the store; the form's defaultValues
  // capture selectedChildId at mount, so a child resolved later (via
  // ensureSelection) or a switch from another tab would otherwise leave
  // childId='' and silently fail validation when the user taps Save.
  useEffect(() => {
    setValue('childId', selectedChildId || '');
  }, [selectedChildId, setValue]);

  useEffect(() => {
    if (!familyId) return;
    loadData();
  }, [familyId]);

  const loadData = async () => {
    if (!familyId) return;
    try {
      const kids = await db.select().from(schema.children).where(eq(schema.children.familyId, familyId));
      setChildrenList(kids);
      const allFoods = await db.select().from(schema.foods).where(eq(schema.foods.familyId, familyId)).orderBy(asc(schema.foods.name));
      setFoodsList(allFoods);
    } catch (err) {
      console.error('Failed to load log data:', err);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    }
  };

  const onSubmit = async (data: ExposureFormData) => {
    setSaving(true);
    try {
      const id = generateId();
      await db.insert(schema.exposures).values({
        id,
        childId: data.childId,
        foodId: data.foodId,
        stage: data.stage,
        rating: data.rating ?? null,
        preparation: data.preparation ?? null,
        temperature: data.temperature ?? null,
        texture: data.texture ?? null,
        mealType: data.mealType ?? null,
        setting: data.setting ?? null,
        notes: data.notes ?? null,
        loggedBy: userId,
        occurredAt: new Date(),
        createdAt: new Date(),
      });

      // Preserve the just-used child so a parent can log multiple
      // exposures in one session without re-tapping the child each time.
      // The form is the single source of truth for foodId/stage now —
      // reset() flows back to the watched values, so no parallel setState.
      reset({ childId: data.childId, foodId: '', stage: 'tolerate' });
      Alert.alert('Logged!', 'Food exposure saved successfully.', [
        { text: 'Log Another', style: 'default' },
        { text: 'Go Home', onPress: () => router.push('/(tabs)' as any) },
      ]);
    } catch (err) {
      console.error('Failed to save exposure:', err);
      Alert.alert('Error', 'Failed to save exposure. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Log Exposure</Text>
        <Text style={styles.subtitle}>Record a food interaction</Text>
      </View>

      {/* Step 1: Select Child */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Child</Text>
        <ChildSelector
          children={childrenList.map((c) => ({ id: c.id, name: c.name, avatarEmoji: c.avatarEmoji }))}
          selectedId={selectedChildId}
          onSelect={(id) => {
            selectChild(id);
            setValue('childId', id);
          }}
        />
        {errors.childId && <Text style={styles.error}>{errors.childId.message}</Text>}
      </View>

      {/* Step 2: Select Food */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Food</Text>
          <Pressable
            onPress={() => router.push('/food/add')}
            accessibilityRole="button"
            accessibilityLabel="Add new food"
          >
            <Text style={styles.addLink}>+ Add New</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.foodGrid}>
          {foodsList.map((food) => (
            <Pressable
              key={food.id}
              style={[styles.foodChip, selectedFoodId === food.id && styles.foodChipSelected]}
              onPress={() => setValue('foodId', food.id)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${food.name}`}
              accessibilityState={{ selected: selectedFoodId === food.id }}
            >
              <Text style={styles.foodChipText}>{food.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {foodsList.length === 0 && (
          <Pressable
            onPress={() => router.push('/food/add')}
            style={styles.emptyFoodsCta}
            accessibilityRole="button"
            accessibilityLabel="Add foods to start logging exposures"
          >
            <Text style={styles.emptyFoodsCtaText}>
              No foods yet — tap to add your first one →
            </Text>
          </Pressable>
        )}
        {errors.foodId && <Text style={styles.error}>{errors.foodId.message}</Text>}
      </View>

      {/* Step 3: Select Stage */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Stage Reached</Text>
        <StageIndicator
          currentStage={selectedStage}
          onStageSelect={(stage) => setValue('stage', stage)}
          size="lg"
          interactive
        />
        <Text style={styles.stageDescription}>
          {STAGE_CONFIG[selectedStage].description}
        </Text>
      </View>

      {/* Step 4: Rating */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Acceptance Rating</Text>
        <Controller
          control={control}
          name="rating"
          render={({ field: { onChange, value } }) => (
            <RatingPicker value={value} onChange={onChange} />
          )}
        />
      </View>

      {/* Toggle Details */}
      <Pressable
        style={styles.detailsToggle}
        onPress={() => setShowDetails(!showDetails)}
        accessibilityRole="button"
        accessibilityLabel={showDetails ? 'Hide additional details' : 'Show additional details'}
        accessibilityState={{ expanded: showDetails }}
      >
        <Text style={styles.detailsToggleText}>
          {showDetails ? 'Hide Details' : 'Add More Details (optional)'}
        </Text>
      </Pressable>

      {/* Optional Details */}
      {showDetails && (
        <View style={styles.detailsSection}>
          {/* Meal Type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Meal</Text>
            <Controller
              control={control}
              name="mealType"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {MEAL_TYPES.map((meal) => {
                    const label = meal.charAt(0).toUpperCase() + meal.slice(1);
                    return (
                      <Pressable
                        key={meal}
                        style={[styles.chip, value === meal && styles.chipSelected]}
                        onPress={() => onChange(meal)}
                        accessibilityRole="button"
                        accessibilityLabel={`Meal: ${label}`}
                        accessibilityState={{ selected: value === meal }}
                      >
                        <Text style={[styles.chipText, value === meal && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Temperature */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Temperature</Text>
            <Controller
              control={control}
              name="temperature"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {TEMPERATURES.map((temp) => {
                    const label = temp.charAt(0).toUpperCase() + temp.slice(1);
                    return (
                      <Pressable
                        key={temp}
                        style={[styles.chip, value === temp && styles.chipSelected]}
                        onPress={() => onChange(temp)}
                        accessibilityRole="button"
                        accessibilityLabel={`Temperature: ${label}`}
                        accessibilityState={{ selected: value === temp }}
                      >
                        <Text style={[styles.chipText, value === temp && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Texture */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Texture</Text>
            <Controller
              control={control}
              name="texture"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {TEXTURES.map((tex) => {
                    const label = tex.charAt(0).toUpperCase() + tex.slice(1);
                    const isSelected = value === tex;
                    return (
                      <Pressable
                        key={tex}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => onChange(tex)}
                        accessibilityRole="button"
                        accessibilityLabel={`Texture: ${label}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Setting */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Setting</Text>
            <Controller
              control={control}
              name="setting"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {SETTINGS.map((setting) => {
                    const label = setting.charAt(0).toUpperCase() + setting.slice(1);
                    const isSelected = value === setting;
                    return (
                      <Pressable
                        key={setting}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => onChange(setting)}
                        accessibilityRole="button"
                        accessibilityLabel={`Setting: ${label}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.textInput}
                  value={value}
                  onChangeText={onChange}
                  placeholder="How did it go? Any observations..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  accessibilityLabel="Notes (optional)"
                />
              )}
            />
          </View>
        </View>
      )}

      {/* Submit */}
      <View style={styles.submitSection}>
        <Button
          label="Save Exposure"
          onPress={handleSubmit(onSubmit as any)}
          loading={saving}
          fullWidth
          size="lg"
          icon="✅"
        />
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
  section: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  addLink: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  foodGrid: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  foodChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  foodChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  foodChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
  },
  stageDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  detailsToggle: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  detailsToggleText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  detailsSection: {
    gap: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  chipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    fontStyle: 'italic',
  },
  emptyFoodsCta: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    alignItems: 'center',
  },
  emptyFoodsCtaText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  error: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
  },
  textInput: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitSection: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
}));
