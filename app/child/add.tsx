import { View, Text, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { childSchema, type ChildFormData } from '@/src/lib/validation';
import { generateId } from '@/src/lib/utils';
import { Button } from '@/src/components';

const EMOJI_OPTIONS = ['👶', '👧', '👦', '🧒', '👸', '🤴', '🦸', '🧑‍🍳', '🐣', '🌟', '🦋', '🐻'];

export default function AddChildScreen() {
  const router = useRouter();
  const { familyId } = useAuthStore();
  const { selectChild } = useChildStore();

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<ChildFormData>({
    resolver: zodResolver(childSchema) as any,
    defaultValues: {
      name: '',
      avatarEmoji: '👶',
    },
  });

  const selectedEmoji = watch('avatarEmoji');

  const onSubmit = async (data: ChildFormData) => {
    if (!familyId) return;

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
    Alert.alert('Added!', `${data.name} has been added.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add Child</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Avatar</Text>
        <View style={styles.emojiGrid}>
          {EMOJI_OPTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[styles.emojiButton, selectedEmoji === emoji && styles.emojiSelected]}
              onPress={() => setValue('avatarEmoji', emoji)}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder="Child's name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
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
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />
          )}
        />
      </View>

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
              placeholder="Allergies, sensitivities..."
              placeholderTextColor="#94A3B8"
              multiline
            />
          )}
        />
      </View>

      <View style={styles.footer}>
        <Button label="Add Child" onPress={handleSubmit(onSubmit as any)} size="lg" fullWidth />
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
