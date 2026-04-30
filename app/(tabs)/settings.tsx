import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';
import { useSettingsStore } from '@/src/stores/settings-store';
import { FEEDING_PROFILES, FEEDING_PROFILE_CONFIG } from '@/src/lib/thresholds';
import { APP_VERSION } from '@/src/lib/constants';
import { exportChildData } from '@/src/lib/export';

export default function SettingsScreen() {
  const router = useRouter();
  const { familyId, displayName, email, logout } = useAuthStore();
  const { selectedChildId } = useChildStore();
  const {
    theme,
    quickLogMode,
    notificationsEnabled,
    feedingProfile,
    setTheme,
    setQuickLogMode,
    setNotificationsEnabled,
    setFeedingProfile,
  } = useSettingsStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!selectedChildId) {
      Alert.alert('No child selected', 'Add or select a child before exporting.');
      return;
    }
    setExporting(true);
    try {
      const [child] = await db
        .select({ name: schema.children.name })
        .from(schema.children)
        .where(eq(schema.children.id, selectedChildId))
        .limit(1);
      await exportChildData(selectedChildId, child?.name ?? 'child');
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
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
          <Pressable
            style={styles.row}
            onPress={() => router.push('/child/add')}
            accessibilityRole="button"
            accessibilityLabel="Add child"
          >
            <Text style={styles.label}>Add Child</Text>
            <Text style={styles.arrow}>{'>'}</Text>
          </Pressable>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Invite Spouse</Text>
            <Text style={styles.value}>Share invite code</Text>
          </View>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Quick Log Mode</Text>
            <Switch
              value={quickLogMode}
              onValueChange={setQuickLogMode}
              trackColor={{ true: '#F97316' }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ true: '#F97316' }}
            />
          </View>
          <View style={styles.divider} />
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
              {FEEDING_PROFILES.map((p) => (
                <Pressable
                  key={p}
                  style={[styles.themeChip, feedingProfile === p && styles.themeChipSelected]}
                  onPress={() => setFeedingProfile(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: feedingProfile === p }}
                >
                  <Text style={[styles.themeText, feedingProfile === p && styles.themeTextSelected]}>
                    {FEEDING_PROFILE_CONFIG[p].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.profileDescription}>
            <Text style={styles.profileDescriptionText}>
              {FEEDING_PROFILE_CONFIG[feedingProfile].description}
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
    color: theme.colors.primary,
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
