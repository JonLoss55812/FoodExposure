import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  color,
  showLabel = true,
  height = 8,
  accessibilityLabel,
}: ProgressBarProps) {
  const { theme } = useUnistyles();
  // Decorative fill, so `primary` (the brand orange) rather than the
  // AA-safe `primaryStrong` — nothing is read against this colour.
  const fillColor = color ?? theme.colors.primary;
  // Defensive coercion: callers today pass validated numbers, but the
  // component is on the hot path (dashboard, food detail, every Progress
  // tab row) and the bracket-deref `current / target` produces Infinity
  // (target=0), NaN (NaN/anything), or negative percentages (current<0)
  // that flow into width: `${pct*100}%` — an invalid CSS value silently
  // drops the bar's visual fill. Same defense-in-depth class as v0.5.106
  // (Number.isFinite rating guard) and v0.5.95 (calcExposureProgress NaN
  // coercion): every numeric input crossing the component boundary is
  // gated to a renderable shape.
  const safeCurrent =
    typeof current === 'number' && Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTarget =
    typeof target === 'number' && Number.isFinite(target) && target > 0 ? target : 1;
  const progress = Math.min(safeCurrent / safeTarget, 1);

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: safeCurrent, min: 0, max: safeTarget }}
    >
      {showLabel && (
        <Text style={styles.label}>
          {safeCurrent}/{safeTarget}
        </Text>
      )}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              backgroundColor: fillColor,
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
