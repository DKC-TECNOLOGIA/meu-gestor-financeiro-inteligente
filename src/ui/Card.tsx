import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { radius, spacing, useThemeColors } from './theme';

export function Card({
  children,
  style,
  padded = true,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: padded ? spacing.lg : 0,
    overflow: 'hidden',
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { backgroundColor: c.surfaceMuted }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  description,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: spacing.md,
          marginBottom: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={12}>
          <AppText variant="label" tone="brand" style={{ fontWeight: '600' }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Section({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ marginTop: spacing.xxl }, style]}>{children}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useThemeColors();
  return <View style={{ height: 1, backgroundColor: c.border, marginLeft: inset }} />;
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'positive' | 'negative' | 'warning';
}) {
  const c = useThemeColors();
  const map = {
    neutral: { bg: c.surfaceMuted, fg: c.textSecondary },
    brand: { bg: c.brandSoft, fg: c.brand },
    positive: { bg: c.successSoft, fg: c.positive },
    negative: { bg: c.negativeSoft, fg: c.negative },
    warning: { bg: c.warningSoft, fg: c.warning },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: map.bg,
      }}
    >
      <AppText variant="caption" style={{ color: map.fg, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}
