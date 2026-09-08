import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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
import { Button } from './Button';

export const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👸', '🤴', '🦸', '🧑‍🍳', '🐣', '🌟', '🦋', '🐻'];

interface ChildFormProps {
  /** Label on the submit button — the one thing the two hosts genuinely disagree on. */
  submitLabel: string;
  submitIcon?: string;
  /**
   * What to do once the row is persisted and selected. The two callers differ
   * only here: `app/child/add.tsx` confirms and pops back, while
   * `app/onboarding/add-child.tsx` sets the onboarding flag and replaces to
   * the tabs. Everything before this point — validation, the insert, the
   * `selectChild` repair, the latch — is identical and now lives once.
   */
  onSaved: (child: { id: string; name: string }) => void;
}

/**
 * The Add Child form, shared by the Settings/Family entry point and the
 * onboarding step. Both screens previously carried their own copy of this
 * body: the same schema wiring, the same avatar grid, the same
 * `?? null` mapping of the optional fields, the same v0.5.144 in-flight
 * latch, and the same v0.5.159 `selectChild` call that makes a newly added
 * child the selection. A fix applied to one was not a fix applied to the
 * other, which is the actual hazard here — `selectChild` in particular is one
 * line whose absence silently logs the next exposure against the wrong child.
 *
 * The host screens keep their own headers, since that is where they really
 * differ: a Cancel link and a plain title on one, step framing and a subtitle
 * on the other.
 */
export function ChildForm({ submitLabel, submitIcon, onSaved }: ChildFormProps) {
  const { familyId } = useAuthStore();
  const { selectChild } = useChildStore();

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
      onSaved({ id: childId, name: data.name });
    } catch (err) {
      console.error('Failed to add child:', err);
      Alert.alert('Error', 'Failed to add child. Please try again.');
    } finally {
      submitLatch.release();
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>Avatar</Text>
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

      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Child's name"
              autoCapitalize="words"
              accessibilityLabel="Child's name"
            />
          )}
        />
        {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Date of Birth (optional)</Text>
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="YYYY-MM-DD"
              accessibilityLabel="Date of birth (optional)"
            />
          )}
        />
        {errors.dateOfBirth && <Text style={styles.error}>{errors.dateOfBirth.message}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes (optional)</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Allergies, sensitivities..."
              multiline
              numberOfLines={3}
              accessibilityLabel="Notes (optional)"
            />
          )}
        />
      </View>

      <View style={styles.footer}>
        <Button
          label={submitLabel}
          onPress={handleSubmit(onSubmit)}
          size="lg"
          fullWidth
          icon={submitIcon}
          loading={saving}
          disabled={saving}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
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
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
}));
