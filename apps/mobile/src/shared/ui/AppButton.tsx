import * as React from 'react';
import { Pressable, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../theme/theme';

type Variant = 'primary' | 'ghost';

export function AppButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator /> : <AppText style={styles.label}>{title}</AppText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.99 }] },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: theme.colors.primaryDark },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
