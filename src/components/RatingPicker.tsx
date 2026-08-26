import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { RATING_CONFIG } from '../lib/constants';

interface RatingPickerProps {
  value?: number;
  // Receives undefined when the selected chip is tapped again — rating
  // is an optional dimension, so a mis-tap must be clearable back to
  // "no rating recorded".
  onChange: (rating: number | undefined) => void;
}

export function RatingPicker({ value, onChange }: RatingPickerProps) {
  return (
    <View style={styles.container}>
      {RATING_CONFIG.map((config) => {
        const isSelected = value === config.value;
        return (
          <Pressable
            key={config.value}
            style={[styles.button, isSelected && styles.selected]}
            onPress={() => onChange(isSelected ? undefined : config.value)}
            accessibilityRole="button"
            accessibilityLabel={`Rating: ${config.label}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={styles.emoji}>{config.emoji}</Text>
            <Text style={[styles.label, isSelected && styles.selectedLabel]}>
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  selectedLabel: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
}));
