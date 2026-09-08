import { View, Text, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/stores/auth-store';
import { ChildForm } from '@/src/components';

export default function AddChildOnboardingScreen() {
  const router = useRouter();
  const { setOnboarded } = useAuthStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.step}>Step 1 of 1</Text>
        <Text style={styles.title}>Add Your Child</Text>
        <Text style={styles.subtitle}>Who are we helping learn to love new foods?</Text>
      </View>

      <ChildForm
        submitLabel="Start Tracking"
        submitIcon="🚀"
        onSaved={() => {
          setOnboarded(true);
          router.replace('/(tabs)' as any);
        }}
      />
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
}));
