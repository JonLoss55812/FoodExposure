import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { foodSchema, type FoodFormData } from '@/src/lib/validation';
import { generateId } from '@/src/lib/utils';
import { FOOD_CATEGORIES, CATEGORY_CONFIG, PREPARATIONS } from '@/src/lib/constants';
import { Button } from '@/src/components';

export default function AddFoodScreen() {
  const router = useRouter();
  const { familyId } = useAuthStore();

  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<
    z.input<typeof foodSchema>,
    unknown,
    FoodFormData
  >({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      name: '',
      category: 'other',
      isSafeFood: false,
    },
  });

  const selectedCategory = watch('category');
  const isSafeFood = watch('isSafeFood');

  const onSubmit = async (data: FoodFormData) => {
    if (!familyId || saving) return;

    setSaving(true);
    try {
      await db.insert(schema.foods).values({
        id: generateId(),
        familyId,
        name: data.name,
        category: data.category,
        defaultPreparation: data.defaultPreparation ?? null,
        isSafeFood: data.isSafeFood,
        createdAt: new Date(),
      });

      Alert.alert('Added!', `${data.name} has been added to your food library.`, [
        {
          text: 'Add Another',
          style: 'default',
          onPress: () =>
            reset({
              name: '',
              category: 'other',
              defaultPreparation: undefined,
              isSafeFood: false,
            }),
        },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('Failed to add food:', err);
      Alert.alert('Error', 'Failed to add food. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cancel and go back"
        >
          <Text style={styles.back}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add Food</Text>
      </View>

      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.label}>Food Name</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder="e.g., Broccoli, Chicken Nuggets"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              maxLength={80}
              accessibilityLabel="Food name"
            />
          )}
        />
        {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
      </View>

      {/* Category */}
      <View style={styles.section}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {FOOD_CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            return (
              <Pressable
                key={cat}
                style={[styles.categoryButton, selectedCategory === cat && styles.categorySelected]}
                onPress={() => setValue('category', cat)}
                accessibilityRole="button"
                accessibilityLabel={`Category: ${config.label}`}
                accessibilityState={{ selected: selectedCategory === cat }}
              >
                <Text style={styles.categoryEmoji}>{config.icon}</Text>
                <Text style={[styles.categoryLabel, selectedCategory === cat && styles.categoryLabelSelected]}>
                  {config.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Preparation */}
      <View style={styles.section}>
        <Text style={styles.label}>Default Preparation (optional)</Text>
        <Controller
          control={control}
          name="defaultPreparation"
          render={({ field: { onChange, value } }) => (
            <View style={styles.chipRow}>
              {PREPARATIONS.map((prep) => {
                const label = prep.charAt(0).toUpperCase() + prep.slice(1);
                return (
                  <Pressable
                    key={prep}
                    style={[styles.chip, value === prep && styles.chipSelected]}
                    onPress={() => onChange(prep)}
                    accessibilityRole="button"
                    accessibilityLabel={`Preparation: ${label}`}
                    accessibilityState={{ selected: value === prep }}
                  >
                    <Text style={[styles.chipText, value === prep && styles.chipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </View>

      {/* Safe Food Toggle */}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Mark as safe food"
        accessibilityState={{ checked: !!isSafeFood }}
        style={[styles.safeToggle, isSafeFood && styles.safeToggleActive]}
        onPress={() => setValue('isSafeFood', !isSafeFood)}
      >
        <Text style={styles.safeIcon}>{isSafeFood ? '✅' : '⬜'}</Text>
        <View style={styles.safeInfo}>
          <Text style={styles.safeTitle}>Safe Food</Text>
          <Text style={styles.safeDesc}>A food your child already accepts and enjoys</Text>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Button label="Add Food" onPress={handleSubmit(onSubmit)} size="lg" fullWidth icon="🍽️" loading={saving} />
      </View>
    </ScrollView>
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
    gap: theme.spacing.sm,
  },
  back: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  section: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  error: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryButton: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  categoryLabelSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
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
  safeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
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
  safeTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  safeDesc: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
}));
