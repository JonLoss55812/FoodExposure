import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/stores/auth-store';
import { generateId, generateInviteCode } from '@/src/lib/utils';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { Button } from '@/src/components';

export default function OnboardingScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const handleGetStarted = async () => {
    if (saving) return;
    setSaving(true);

    const familyId = generateId();
    const userId = generateId();
    const inviteCode = generateInviteCode();

    try {
      await db.insert(schema.families).values({
        id: familyId,
        name: 'My Family',
        inviteCode,
        createdAt: new Date(),
      });

      await db.insert(schema.users).values({
        id: userId,
        familyId,
        email: 'local@tonguetutor.app',
        displayName: 'Parent',
        createdAt: new Date(),
      });

      login({
        userId,
        familyId,
        email: 'local@tonguetutor.app',
        displayName: 'Parent',
      });

      router.push('/onboarding/add-child');
    } catch (err) {
      console.error('Failed to start onboarding:', err);
      Alert.alert('Error', 'Failed to start. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>👅</Text>
        <Text style={styles.title}>TongueTutor</Text>
        <Text style={styles.tagline}>So Your Tongue Can Learn</Text>

        <View style={styles.info}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🔬</Text>
            <Text style={styles.infoText}>
              Research shows children need <Text style={styles.bold}>8-15 exposures</Text> to accept a new food
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📈</Text>
            <Text style={styles.infoText}>
              Track progress through <Text style={styles.bold}>6 stages</Text>: Tolerate, Interact, Smell, Touch, Taste, Eat
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>👨‍👩‍👧</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Share with your partner</Text> so both parents can track together
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>😊</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>No pressure</Text> — every small step counts as progress
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Get Started"
          onPress={handleGetStarted}
          size="lg"
          fullWidth
          loading={saving}
          disabled={saving}
        />
        <Pressable
          style={styles.joinLink}
          onPress={() => router.push('/onboarding/join')}
          accessibilityRole="button"
          accessibilityLabel="Have an invite code? Join your family"
        >
          <Text style={styles.joinText}>Have an invite code? Join your family</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: theme.colors.text,
  },
  tagline: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  info: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
    width: '100%',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  infoIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  joinLink: {
    alignItems: 'center',
  },
  joinText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
}));
