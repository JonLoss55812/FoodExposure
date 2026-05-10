import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { getStageConfig, RATING_CONFIG } from '../lib/constants';
import { formatRelativeDate } from '../lib/utils';

interface ExposureCardProps {
  foodName: string;
  childName: string;
  stage: string;
  rating?: number;
  notes?: string;
  occurredAt: Date;
  mealType?: string;
  temperature?: string;
  texture?: string;
  setting?: string;
  onPress?: () => void;
}

const META_ICONS = {
  mealType: '🍽️',
  temperature: '🌡️',
  texture: '🧊',
  setting: '📍',
} as const;

export function ExposureCard({
  foodName,
  childName,
  stage,
  rating,
  notes,
  occurredAt,
  mealType,
  temperature,
  texture,
  setting,
  onPress,
}: ExposureCardProps) {
  const stageConfig = getStageConfig(stage);
  const ratingConfig = rating ? RATING_CONFIG.find((r) => r.value === rating) : null;
  const hasMeta = !!(mealType || temperature || texture || setting);

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open ${foodName} details` : undefined}
    >
      <View style={styles.header}>
        <View style={[styles.stageIcon, { backgroundColor: stageConfig.color + '20' }]}>
          <Text style={{ fontSize: 20 }}>{stageConfig.icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.foodName} numberOfLines={1}>
            {foodName}
          </Text>
          {childName ? (
            <Text style={styles.childName}>{childName}</Text>
          ) : null}
        </View>
        <View style={styles.right}>
          {ratingConfig && <Text style={{ fontSize: 20 }}>{ratingConfig.emoji}</Text>}
          <Text style={styles.date}>{formatRelativeDate(occurredAt)}</Text>
        </View>
      </View>
      {notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {notes}
        </Text>
      )}
      {hasMeta && (
        <View style={styles.metaRow}>
          {mealType && <Text style={styles.metaItem}>{META_ICONS.mealType} {mealType}</Text>}
          {temperature && <Text style={styles.metaItem}>{META_ICONS.temperature} {temperature}</Text>}
          {texture && <Text style={styles.metaItem}>{META_ICONS.texture} {texture}</Text>}
          {setting && <Text style={styles.metaItem}>{META_ICONS.setting} {setting}</Text>}
        </View>
      )}
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
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  foodName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  childName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  date: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
  },
  notes: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metaItem: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    textTransform: 'capitalize',
  },
}));
