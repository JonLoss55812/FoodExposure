import { useRef, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter, useFocusEffect } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { formatChildAge } from '@/src/lib/utils';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { useSettingsStore } from '@/src/stores/settings-store';
import { FEEDING_PROFILES, FEEDING_PROFILE_CONFIG, getFeedingProfileConfig } from '@/src/lib/thresholds';
import { APP_VERSION } from '@/src/lib/constants';
import { exportChildData } from '@/src/lib/export';
import { deleteChildCascade } from '@/src/lib/cascade-delete';
import { createInFlightLatch } from '@/src/lib/in-flight';
import { childSchema } from '@/src/lib/validation';

type ChildRow = Pick<
  typeof schema.children.$inferSelect,
  'id' | 'name' | 'avatarEmoji' | 'dateOfBirth' | 'notes'
>;

export default function SettingsScreen() {
  const router = useRouter();
  const { displayName, email, familyId, logout } = useAuthStore();
  const { selectedChildId, ensureSelection, clear: clearChildSelection } = useChildStore();
  const { theme, feedingProfile, setTheme, setFeedingProfile } = useSettingsStore();
  const [exporting, setExporting] = useState(false);
  const [childrenList, setChildrenList] = useState<ChildRow[]>([]);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [savingChildId, setSavingChildId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  // The state flags lag a render behind the tap; the latches are synchronous.
  const exportLatch = useRef(createInFlightLatch()).current;
  const deleteChildLatch = useRef(createInFlightLatch()).current;
  const renameChildLatch = useRef(createInFlightLatch()).current;

  const loadChildren = useCallback(async () => {
    if (!familyId) {
      setChildrenList([]);
      return;
    }
    try {
      const rows = await db
        .select({
          id: schema.children.id,
          name: schema.children.name,
          avatarEmoji: schema.children.avatarEmoji,
          dateOfBirth: schema.children.dateOfBirth,
          notes: schema.children.notes,
        })
        .from(schema.children)
        .where(eq(schema.children.familyId, familyId));
      setChildrenList(rows);
    } catch (err) {
      console.error('Failed to load children:', err);
    }
  }, [familyId]);

  useFocusEffect(
    useCallback(() => {
      loadChildren();
    }, [loadChildren])
  );

  /**
   * A child's name was the last permanent-or-destructive field in the app:
   * foods gained rename/category/preparation editing (v0.5.145/160/161) and
   * every field on an exposure became correctable (v0.5.167-171), but a
   * mistyped child name could only be "fixed" by Delete Child — which
   * cascades away every exposure that child has ever logged, i.e. the exact
   * history the 15/20/30 acceptance threshold is counted from.
   *
   * Validation goes through `childSchema.shape.name` rather than a
   * hand-rolled check, so Add Child and this editor agree on trim and the
   * 1..50 bounds and the user sees the schema's own message. Unlike the food
   * rename there is deliberately **no** uniqueness guard: `children` carries
   * no uniqueness contract on add either (two children may legitimately share
   * a name), so adding one here would reject a rename the add path allows.
   */
  const handleSaveChildName = async (child: ChildRow) => {
    if (!renameChildLatch.tryAcquire()) return;

    const parsed = childSchema.shape.name.safeParse(nameDraft);
    if (!parsed.success) {
      renameChildLatch.release();
      Alert.alert('Invalid Name', parsed.error.issues[0]?.message ?? "Please enter the child's name.");
      return;
    }
    const nextName = parsed.data;
    // The schema trims, so a draft equal to the stored name after trimming is
    // a no-op that closes without touching the DB.
    if (nextName === child.name) {
      renameChildLatch.release();
      setEditingChildId(null);
      return;
    }

    setSavingChildId(child.id);
    try {
      await db
        .update(schema.children)
        .set({ name: nextName })
        .where(eq(schema.children.id, child.id));
      // Patched rather than reloaded: the screen loads on focus, and nothing
      // else on it depends on the children query.
      setChildrenList((rows) => rows.map((c) => (c.id === child.id ? { ...c, name: nextName } : c)));
      setEditingChildId(null);
    } catch (err) {
      console.error('Failed to rename child:', err);
      // Leave the editor open with the draft intact so the retry is one tap.
      Alert.alert('Error', 'Failed to rename child. Please try again.');
    } finally {
      renameChildLatch.release();
      setSavingChildId(null);
    }
  };

  const handleDeleteChild = (child: ChildRow) => {
    if (deleteChildLatch.busy) return;
    Alert.alert(
      'Delete Child?',
      `${child.name} and all of their logged exposures will be permanently deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!deleteChildLatch.tryAcquire()) return;
            setDeletingChildId(child.id);
            try {
              await deleteChildCascade(db, child.id);
              const remaining = childrenList.filter((c) => c.id !== child.id);
              setChildrenList(remaining);
              ensureSelection(remaining);
            } catch (err) {
              console.error('Failed to delete child:', err);
              Alert.alert('Error', 'Failed to delete child. Please try again.');
            } finally {
              deleteChildLatch.release();
              setDeletingChildId(null);
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (!selectedChildId) {
      Alert.alert('No child selected', 'Add or select a child before exporting.');
      return;
    }
    if (!exportLatch.tryAcquire()) return;
    setExporting(true);
    try {
      const [child] = await db
        .select({ name: schema.children.name, dateOfBirth: schema.children.dateOfBirth })
        .from(schema.children)
        .where(eq(schema.children.id, selectedChildId))
        .limit(1);
      await exportChildData(selectedChildId, child?.name ?? 'child', child?.dateOfBirth);
    } catch (err) {
      console.error('Failed to export data:', err);
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      exportLatch.release();
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          clearChildSelection();
          logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{displayName || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{email || 'Not set'}</Text>
          </View>
        </View>
      </View>

      {/* Family Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Family</Text>
        <View style={styles.card}>
          {childrenList.map((child) => {
            const isDeleting = deletingChildId === child.id;
            const isSaving = savingChildId === child.id;
            const isEditing = editingChildId === child.id;
            // No two per-row writes may race on the same `childrenList` patch.
            const rowBusy = !!deletingChildId || !!savingChildId;
            const childAge = formatChildAge(child.dateOfBirth);
            return (
              <View key={child.id}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.nameInput}
                      value={nameDraft}
                      onChangeText={setNameDraft}
                      placeholder="Child's name"
                      maxLength={50}
                      accessibilityLabel="Child's name"
                    />
                    <View style={styles.editActions}>
                      <Pressable
                        onPress={() => handleSaveChildName(child)}
                        disabled={rowBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Save name for ${child.name}`}
                        accessibilityState={{ disabled: rowBusy, busy: isSaving }}
                      >
                        <Text style={styles.saveChildText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditingChildId(null)}
                        disabled={rowBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel renaming ${child.name}`}
                      >
                        <Text style={styles.cancelChildText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Pressable
                      style={styles.childIdentity}
                      onPress={() => router.push(`/child/${child.id}` as any)}
                      disabled={rowBusy}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${child.name}'s details`}
                    >
                      <Text style={styles.label}>
                        {child.avatarEmoji} {child.name}
                      </Text>
                      {/*
                        `dateOfBirth` and `notes` have been captured since
                        v0.1.0 and read back by nothing — this is the first
                        surface that shows a parent what they typed. Both
                        collapse when absent, which is the common case: they
                        are optional on the add path and most parents skip
                        them.
                      */}
                      {childAge ? <Text style={styles.childMeta}>{childAge}</Text> : null}
                      {child.notes ? (
                        <Text style={styles.childMeta} numberOfLines={2}>
                          {child.notes}
                        </Text>
                      ) : null}
                    </Pressable>
                    <View style={styles.editActions}>
                      <Pressable
                        onPress={() => {
                          setNameDraft(child.name);
                          setEditingChildId(child.id);
                        }}
                        disabled={rowBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${child.name}`}
                        accessibilityState={{ disabled: rowBusy }}
                      >
                        <Text style={styles.renameChildText}>Rename</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteChild(child)}
                        disabled={rowBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${child.name}`}
                        accessibilityState={{ disabled: rowBusy, busy: isDeleting }}
                      >
                        <Text style={styles.deleteChildText}>
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                <View style={styles.divider} />
              </View>
            );
          })}
          <Pressable
            style={styles.row}
            onPress={() => router.push('/child/add')}
            accessibilityRole="button"
            accessibilityLabel="Add child"
          >
            <Text style={styles.label}>Add Child</Text>
            <Text style={styles.arrow}>{'>'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Theme</Text>
            <View style={styles.themeRow}>
              {(['light', 'dark', 'system'] as const).map((t) => {
                const label = t.charAt(0).toUpperCase() + t.slice(1);
                return (
                  <Pressable
                    key={t}
                    style={[styles.themeChip, theme === t && styles.themeChipSelected]}
                    onPress={() => setTheme(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`Theme: ${label}`}
                    accessibilityState={{ selected: theme === t }}
                  >
                    <Text style={[styles.themeText, theme === t && styles.themeTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* Feeding Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feeding Profile</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Text style={styles.label}>Exposure Target</Text>
            <View style={styles.profileChips}>
              {FEEDING_PROFILES.map((p) => {
                const profileLabel = FEEDING_PROFILE_CONFIG[p].label;
                return (
                  <Pressable
                    key={p}
                    style={[styles.themeChip, feedingProfile === p && styles.themeChipSelected]}
                    onPress={() => setFeedingProfile(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Profile: ${profileLabel}`}
                    accessibilityState={{ selected: feedingProfile === p }}
                  >
                    <Text style={[styles.themeText, feedingProfile === p && styles.themeTextSelected]}>
                      {profileLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileDescription}>
            <Text style={styles.profileDescriptionText}>
              {getFeedingProfileConfig(feedingProfile).description}
            </Text>
          </View>
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Export data as CSV"
            accessibilityState={{ disabled: exporting, busy: exporting }}
          >
            <Text style={styles.label}>Export Data (CSV)</Text>
            <Text style={styles.value}>{exporting ? 'Exporting…' : 'Share'}</Text>
          </Pressable>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>{APP_VERSION}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>SOS Approach</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <Pressable
        style={styles.signOutButton}
        onPress={handleLogout}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* Tagline */}
      <Text style={styles.tagline}>So Your Tongue Can Learn</Text>
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
  section: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  value: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  arrow: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textTertiary,
  },
  deleteChildText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.error,
  },
  renameChildText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primaryStrong,
  },
  saveChildText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primaryStrong,
  },
  cancelChildText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  childIdentity: {
    flex: 1,
    gap: 2,
  },
  childMeta: {
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  editRow: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    minHeight: 44,
  },
  themeRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  profileRow: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  profileChips: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  profileDescription: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  profileDescriptionText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  themeChip: {
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
  },
  themeChipSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  themeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  themeTextSelected: {
    color: theme.colors.primaryStrong,
    fontWeight: '600',
  },
  signOutButton: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.error + '15',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.error,
  },
  tagline: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
    marginTop: theme.spacing.lg,
  },
}));
