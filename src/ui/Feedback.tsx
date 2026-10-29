import { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { radius, spacing, useThemeColors } from './theme';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  return (
    <View
      style={[
        { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
        style,
      ]}
    >
      {Icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.brandSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Icon color={c.brand} size={26} strokeWidth={1.8} />
        </View>
      ) : null}
      <AppText variant="bodyStrong" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText
          variant="label"
          tone="secondary"
          align="center"
          style={{ marginTop: spacing.xs, maxWidth: 320 }}
        >
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="sm"
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

export type MessageTone = 'info' | 'success' | 'warning' | 'danger';

export function InlineMessage({
  tone = 'info',
  title,
  message,
  action,
  style,
}: {
  tone?: MessageTone;
  title?: string;
  message: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  const messageMap: Record<MessageTone, { bg: string; fg: string; icon: LucideIcon }> = {
    info: { bg: c.infoSoft, fg: c.info, icon: Info },
    success: { bg: c.successSoft, fg: c.positive, icon: CircleCheck },
    warning: { bg: c.warningSoft, fg: c.warning, icon: TriangleAlert },
    danger: { bg: c.negativeSoft, fg: c.negative, icon: CircleAlert },
  };
  const m = messageMap[tone];
  const Icon = m.icon;
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[
        {
          flexDirection: 'row',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: m.bg,
        },
        style,
      ]}
    >
      <Icon color={m.fg} size={18} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <AppText variant="label" style={{ color: m.fg, fontWeight: '600' }}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="label" style={{ color: c.text }}>
          {message}
        </AppText>
        {action}
      </View>
    </View>
  );
}

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  const c = useThemeColors();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
        gap: spacing.md,
      }}
    >
      <ActivityIndicator color={c.brand} />
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}
