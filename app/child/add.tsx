import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { ChildForm } from '@/src/components';

export default function AddChildScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.back}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Add Child</Text>
      </View>

      <ChildForm
        submitLabel="Add Child"
        onSaved={({ name }) =>
          Alert.alert('Added!', `${name} has been added.`, [
            { text: 'OK', onPress: () => router.back() },
          ])
        }
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
}));
