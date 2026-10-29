import { Pressable, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { radius, spacing, useThemeColors } from './theme';

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: spacing.md + 2,
        borderRadius: radius.pill,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? c.brand : c.border,
        backgroundColor: selected ? c.brand : pressed ? c.surfaceMuted : c.surface,
      })}
    >
      <AppText
        variant="label"
        style={{
          color: selected ? '#FFFFFF' : c.text,
          fontWeight: selected ? '600' : '500',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -spacing.xl, flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </ScrollView>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const c = useThemeColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: radius.md,
        backgroundColor: c.surfaceMuted,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: radius.md - 3,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? c.surface : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: c.border,
            }}
          >
            <AppText
              variant="label"
              numberOfLines={1}
              style={{
                color: selected ? c.text : c.textSecondary,
                fontWeight: selected ? '600' : '500',
              }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
