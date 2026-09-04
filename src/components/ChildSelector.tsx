import { ScrollView, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface Child {
  id: string;
  name: string;
  avatarEmoji: string;
}

interface ChildSelectorProps {
  children: Child[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ChildSelector({ children, selectedId, onSelect }: ChildSelectorProps) {
  if (children.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {children.map((child) => {
        const isSelected = child.id === selectedId;
        return (
          <Pressable
            key={child.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(child.id)}
            accessibilityRole="button"
            accessibilityLabel={`Select ${child.name}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={styles.emoji}>{child.avatarEmoji}</Text>
            <Text style={[styles.name, isSelected && styles.nameSelected]}>
              {child.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  emoji: {
    fontSize: 20,
  },
  name: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  nameSelected: {
    color: theme.colors.primaryStrong,
    fontWeight: '700',
  },
}));
