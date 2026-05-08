import { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { and, eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { generateId, deriveLocalEmailPart, isValidInviteCode } from '@/src/lib/utils';
import { Button } from '@/src/components';

export default function JoinFamilyScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmedCode = inviteCode.trim().toUpperCase();
    const trimmedName = displayName.trim();

    if (!trimmedCode || !trimmedName) {
      Alert.alert('Missing Info', 'Please enter both your name and the invite code.');
      return;
    }

    if (!isValidInviteCode(trimmedCode)) {
      Alert.alert(
        'Invalid Code',
        'Invite code must be 6 characters and use only A–Z (excluding I, O) and 2–9.'
      );
      return;
    }

    setLoading(true);
    try {
      const family = await db.select().from(schema.families)
        .where(eq(schema.families.inviteCode, trimmedCode))
        .then(rows => rows[0]);

      if (!family) {
        Alert.alert('Not Found', 'No family found with that invite code. Make sure you\'re connected to sync first, or ask your partner to share the code again.');
        return;
      }

      const email = `${deriveLocalEmailPart(trimmedName)}@tonguetutor.app`;
      const existingUser = await db.select().from(schema.users)
        .where(and(eq(schema.users.familyId, family.id), eq(schema.users.email, email)))
        .then(rows => rows[0]);

      if (existingUser) {
        Alert.alert(
          'Name Already Taken',
          'A family member is already using this name. Please choose a different display name.'
        );
        return;
      }

      const userId = generateId();
      await db.insert(schema.users).values({
        id: userId,
        familyId: family.id,
        email,
        displayName: trimmedName,
        createdAt: new Date(),
      });

      login({
        userId,
        familyId: family.id,
        email,
        displayName: trimmedName,
      });

      router.replace('/(tabs)' as any);
    } catch (err) {
      console.error('Failed to join family:', err);
      Alert.alert('Error', 'Failed to join family. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Join Your Family</Text>
        <Text style={styles.subtitle}>Enter the invite code from your partner</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor="#94A3B8"
              autoCapitalize="words"
              maxLength={50}
              accessibilityLabel="Your name"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Invite Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              maxLength={6}
              accessibilityLabel="Invite code"
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Join Family" onPress={handleJoin} loading={loading} size="lg" fullWidth />
        <Button label="Go Back" onPress={() => router.back()} variant="ghost" size="md" fullWidth />
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 100,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  form: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  field: {
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
  codeInput: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
}));
