import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { STAGE_ORDER, STAGE_CONFIG, type ExposureStage } from '../lib/constants';

interface StageIndicatorProps {
  currentStage?: ExposureStage;
  onStageSelect?: (stage: ExposureStage) => void;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const dotSizeStyles = {
  sm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  md: {
    width: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 8,
    borderRadius: 12,
  },
  lg: {
    width: 56,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 16,
  },
};

const iconSizeStyles = {
  sm: { fontSize: 14 },
  md: { fontSize: 18 },
  lg: { fontSize: 24 },
};

export function StageIndicator({
  currentStage,
  onStageSelect,
  size = 'md',
  interactive = false,
}: StageIndicatorProps) {
  const currentIndex = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;

  return (
    <View style={styles.container}>
      {STAGE_ORDER.map((stage, index) => {
        const config = STAGE_CONFIG[stage];
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        const dot = (
          <View
            key={stage}
            style={[
              styles.dot,
              dotSizeStyles[size],
              { backgroundColor: isActive ? config.color : '#E2E8F0' },
              isCurrent && styles.currentDot,
            ]}
          >
            <Text style={[styles.icon, iconSizeStyles[size]]}>{config.icon}</Text>
            {size !== 'sm' && (
              <Text
                style={[styles.label, { color: isActive ? config.color : '#94A3B8' }]}
                numberOfLines={1}
              >
                {config.label}
              </Text>
            )}
          </View>
        );

        if (interactive && onStageSelect) {
          return (
            <Pressable
              key={stage}
              onPress={() => onStageSelect(stage)}
              accessibilityRole="button"
              accessibilityLabel={`Stage: ${config.label}`}
              accessibilityState={{ selected: isCurrent }}
            >
              {dot}
            </Pressable>
          );
        }

        return dot;
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  dot: {},
  currentDot: {
    transform: [{ scale: 1.1 }],
  },
  icon: {},
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
}));
