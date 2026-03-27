import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const { theme } = useUnistyles();

  const variantContainerStyles = {
    primary: { backgroundColor: theme.colors.primary },
    secondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
    ghost: { backgroundColor: 'transparent' },
  };

  const sizeContainerStyles = {
    sm: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
    md: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm + 4 },
    lg: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  };

  const variantLabelStyles = {
    primary: { color: theme.colors.white },
    secondary: { color: theme.colors.text },
    ghost: { color: theme.colors.primary },
  };

  const sizeLabelStyles = {
    sm: { fontSize: theme.fontSize.sm },
    md: { fontSize: theme.fontSize.md },
    lg: { fontSize: theme.fontSize.lg },
  };

  return (
    <Pressable
      style={[
        styles.container,
        variantContainerStyles[variant],
        sizeContainerStyles[size],
        fullWidth && { width: '100%' },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFF' : '#F97316'} />
      ) : (
        <View style={styles.content}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.label, variantLabelStyles[variant], sizeLabelStyles[size]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
}));
