import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { and, eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { ChildForm, EmptyState, type ChildFormRecord } from '@/src/components';
import { formatChildAge } from '@/src/lib/utils';

/**
 * Child detail / edit screen. A child's date of birth and notes are captured
 * on Add Child and shown on the Settings row (v0.5.178), but until this screen
 * nothing could change them — a typo in either was permanent short of Delete
 * Child, which cascades away every exposure that child has logged. This hosts
 * the shared `ChildForm` in its edit mode, so the add and edit paths validate
 * through the same `childSchema` and cannot drift apart.
 */
export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useUnistyles();
  const { familyId } = useAuthStore();

  const [child, setChild] = useState<ChildFormRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || !familyId) {
        setLoading(false);
        return;
      }
      try {
        // Scoped by family as well as id: a route param naming another
        // family's child must read as not-found, not open their record.
        const rows = await db
          .select({
            id: schema.children.id,
            name: schema.children.name,
            dateOfBirth: schema.children.dateOfBirth,
            avatarEmoji: schema.children.avatarEmoji,
            notes: schema.children.notes,
          })
          .from(schema.children)
          .where(and(eq(schema.children.id, id), eq(schema.children.familyId, familyId)));
        if (!cancelled) setChild(rows[0] ?? null);
      } catch (err) {
        console.error('Failed to load child:', err);
        Alert.alert('Error', 'Failed to load child details. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, familyId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="🤔"
          title="Child Not Found"
          description="This child may have been removed from your family."
          actionLabel="Go to Settings"
          onAction={() => router.replace('/(tabs)/settings' as any)}
        />
      </View>
    );
  }

  const age = formatChildAge(child.dateOfBirth);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.back}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>
          {child.avatarEmoji} {child.name}
        </Text>
        {age ? <Text style={styles.subtitle}>{age}</Text> : null}
      </View>

      <ChildForm child={child} submitLabel="Save Changes" onSaved={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
}));
