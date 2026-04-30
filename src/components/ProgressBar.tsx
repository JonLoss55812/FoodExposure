import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface ProgressBarProps {
  current: number;
  target?: number;
  color?: string;
  showLabel?: boolean;
  height?: number;
  accessibilityLabel?: string;
}

export function ProgressBar({
  current,
  target = 15,
  color = '#F97316',
  showLabel = true,
  height = 8,
  accessibilityLabel,
}: ProgressBarProps) {
  const progress = Math.min(current / target, 1);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: current, min: 0, max: target }}
    >
      {showLabel && (
        <Text style={styles.label}>
          {current}/{target}
        </Text>
      )}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              backgroundColor: color,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  track: {
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: theme.borderRadius.full,
  },
}));
