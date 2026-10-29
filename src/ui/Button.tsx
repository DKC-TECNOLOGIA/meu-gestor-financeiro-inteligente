import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText } from './AppText';
import { radius, spacing, touchTarget, useThemeColors } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDeep';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const c = useThemeColors();
  const variantStyles: Record<
    ButtonVariant,
    { bg: string; bgPressed: string; fg: string; border?: string }
  > = {
    primary: { bg: c.brand, bgPressed: c.brandPressed, fg: '#FFFFFF' },
    secondary: {
      bg: c.surface,
      bgPressed: c.surfaceMuted,
      fg: c.text,
      border: c.borderStrong,
    },
    ghost: { bg: 'transparent', bgPressed: c.brandSoft, fg: c.brand },
    danger: { bg: c.negativeSoft, bgPressed: '#FEE2E2', fg: c.negative },
    onDeep: { bg: c.brandDeepRaised, bgPressed: '#1A6247', fg: c.textOnDeep },
  };
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const height = size === 'md' ? touchTarget : 36;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          minHeight: height,
          paddingHorizontal: size === 'md' ? spacing.xl : spacing.md,
          borderRadius: radius.md,
          backgroundColor: pressed ? v.bgPressed : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : Icon ? (
        <Icon color={v.fg} size={size === 'md' ? 18 : 16} strokeWidth={2.2} />
      ) : null}
      <AppText
        variant={size === 'md' ? 'bodyStrong' : 'label'}
        style={{ color: v.fg, fontWeight: '600' }}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  variant = 'secondary',
  size = 40,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: ButtonVariant;
  size?: number;
}) {
  const c = useThemeColors();
  const variantStyles: Record<
    ButtonVariant,
    { bg: string; bgPressed: string; fg: string; border?: string }
  > = {
    primary: { bg: c.brand, bgPressed: c.brandPressed, fg: '#FFFFFF' },
    secondary: {
      bg: c.surface,
      bgPressed: c.surfaceMuted,
      fg: c.text,
      border: c.borderStrong,
    },
    ghost: { bg: 'transparent', bgPressed: c.brandSoft, fg: c.brand },
    danger: { bg: c.negativeSoft, bgPressed: '#FEE2E2', fg: c.negative },
    onDeep: { bg: c.brandDeepRaised, bgPressed: '#1A6247', fg: c.textOnDeep },
  };
  const v = variantStyles[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={(touchTarget - size) / 2 > 0 ? (touchTarget - size) / 2 : 0}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? v.bgPressed : v.bg,
        borderWidth: v.border ? 1 : 0,
        borderColor: c.border,
      })}
    >
      <Icon color={v.fg} size={Math.round(size * 0.48)} strokeWidth={2} />
    </Pressable>
  );
}

export function QuickAction({
  icon: Icon,
  label,
  onPress,
  onDeep = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  onDeep?: boolean;
}): ReactNode {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onDeep ? c.brandDeepRaised : c.brandSoft,
        }}
      >
        <Icon color={onDeep ? c.accentOnDeep : c.brand} size={22} strokeWidth={2} />
      </View>
      <AppText variant="caption" tone={onDeep ? 'onDeep' : 'default'} align="center" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}
