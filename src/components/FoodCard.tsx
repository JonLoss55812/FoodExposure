import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { getCategoryConfig, getStageConfig, type ExposureStage } from '../lib/constants';
import { ProgressBar } from './ProgressBar';

interface FoodCardProps {
  name: string;
  category: string;
  currentStage?: ExposureStage;
  exposureCount: number;
  /**
   * Exposures to acceptance for the active feeding profile (15/20/30).
   * Required: a default would silently measure picky and ARFID profiles
   * against the typical threshold (the v0.5.220 bug).
   */
  target: number;
  isSafeFood: boolean;
  onPress?: () => void;
}

export function FoodCard({
  name,
  category,
  currentStage,
  exposureCount,
  target,
  isSafeFood,
  onPress,
}: FoodCardProps) {
  const categoryConfig = getCategoryConfig(category);
  const stageConfig = currentStage ? getStageConfig(currentStage) : null;

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name} details`}
    >
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
          <Text style={styles.categoryIcon}>{categoryConfig.icon}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            {isSafeFood && (
              <Text
                accessibilityLabel="Safe food"
                accessibilityRole="image"
                style={styles.safeStar}
              >
                ⭐
              </Text>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <View style={styles.meta}>
            {stageConfig && (
              <View style={[styles.stageBadge, { backgroundColor: stageConfig.color + '20' }]}>
                <Text style={{ fontSize: 12 }}>{stageConfig.icon}</Text>
                <Text style={styles.stageLabel}>
                  {stageConfig.label}
                </Text>
              </View>
            )}
            {isSafeFood && (
              <View style={styles.safeBadge}>
                <Text style={styles.safeLabel}>Safe Food</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <ProgressBar
        current={exposureCount}
        target={target}
        color={stageConfig?.color}
        height={6}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  categoryBadge: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  safeStar: {
    fontSize: theme.fontSize.md,
  },
  name: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    flexShrink: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  // Label text stays on the theme's text colour; the tinted pill and the icon
  // carry the stage/safe-food hue. As text, the hues themselves are 1.8-2.7:1
  // on their own light tint — below the 4.5:1 AA needs at 12px.
  stageLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
  },
  safeBadge: {
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  safeLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
  },
}));
