import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AppText } from './AppText';
import { spacing, useThemeColors } from './theme';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  showChevron,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
}: ListRowProps) {
  const c = useThemeColors();
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <ChevronRight color={c.textTertiary} size={18} /> : null}
    </>
  );

  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
  };

  if (onPress || onLongPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.6 : 1 }, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{content}</View>;
}
