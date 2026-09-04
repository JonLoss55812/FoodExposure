import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { childSchema, type ChildFormData } from '@/src/lib/validation';
import { generateId } from '@/src/lib/utils';
import { createInFlightLatch } from '@/src/lib/in-flight';
import { Button } from '@/src/components';

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👸', '🤴', '🦸', '🧑‍🍳', '🐣', '🌟', '🦋', '🐻'];

export default function AddChildOnboardingScreen() {
  const router = useRouter();
  const { familyId } = useAuthStore();
  const { selectChild } = useChildStore();
  const { setOnboarded } = useAuthStore();

  const [saving, setSaving] = useState(false);
  // `saving` lags a render behind the tap; the latch is synchronous.
  const submitLatch = useRef(createInFlightLatch()).current;

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<
    z.input<typeof childSchema>,
    unknown,
    ChildFormData
  >({
    resolver: zodResolver(childSchema),
    defaultValues: {
      name: '',
      avatarEmoji: '👶',
    },
  });

  const selectedEmoji = watch('avatarEmoji');

  const onSubmit = async (data: ChildFormData) => {
    if (!familyId || !submitLatch.tryAcquire()) return;

    setSaving(true);
    try {
      const childId = generateId();
      await db.insert(schema.children).values({
        id: childId,
        familyId,
        name: data.name,
        dateOfBirth: data.dateOfBirth ?? null,
        avatarEmoji: data.avatarEmoji,
        notes: data.notes ?? null,
        createdAt: new Date(),
      });

      selectChild(childId);
      setOnboarded(true);
      router.replace('/(tabs)' as any);
    } catch (err) {
      console.error('Failed to add child:', err);
      Alert.alert('Error', 'Failed to add child. Please try again.');
    } finally {
      submitLatch.release();
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.step}>Step 1 of 1</Text>
        <Text style={styles.title}>Add Your Child</Text>
        <Text style={styles.subtitle}>Who are we helping learn to love new foods?</Text>
      </View>

      {/* Emoji Picker */}
      <View style={styles.section}>
        <Text style={styles.label}>Choose an Avatar</Text>
        <View style={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((emoji) => {
            const isSelected = selectedEmoji === emoji;
            return (
              <Pressable
                key={emoji}
                style={[styles.emojiButton, isSelected && styles.emojiSelected]}
                onPress={() => setValue('avatarEmoji', emoji)}
                accessibilityRole="button"
                accessibilityLabel={`Avatar: ${emoji}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.label}>Child's Name</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder="Enter name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              maxLength={50}
              accessibilityLabel="Child's name"
            />
          )}
        />
        {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
      </View>

      {/* Date of Birth */}
      <View style={styles.section}>
        <Text style={styles.label}>Date of Birth (optional)</Text>
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Date of birth (optional)"
            />
          )}
        />
        {errors.dateOfBirth && <Text style={styles.error}>{errors.dateOfBirth.message}</Text>}
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.label}>Notes (optional)</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={value}
              onChangeText={onChange}
              placeholder="Allergies, sensitivities, therapy info..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              maxLength={500}
              accessibilityLabel="Notes (optional)"
            />
          )}
        />
      </View>

      <View style={styles.footer}>
        <Button
          label="Start Tracking"
          onPress={handleSubmit(onSubmit)}
          size="lg"
          fullWidth
          icon="🚀"
          loading={saving}
          disabled={saving}
        />
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 80,
    gap: theme.spacing.xs,
  },
  step: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryStrong,
    fontWeight: '600',
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  emojiButton: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  emoji: {
    fontSize: 28,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
}));
