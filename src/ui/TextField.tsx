import { useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText } from './AppText';
import { radius, spacing, touchTarget, typography, useThemeColors } from './theme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: LucideIcon;
  prefix?: string;
}

export function TextField({
  label,
  hint,
  error,
  icon: Icon,
  prefix,
  style,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: TextFieldProps) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.negative : focused ? c.brand : c.border;

  return (
    <View style={{ gap: spacing.xs + 2 }}>
      {label ? (
        <AppText variant="label" tone="secondary">
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          minHeight: touchTarget,
          flexDirection: 'row',
          alignItems: rest.multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md + 2,
          borderRadius: radius.md,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: editable ? c.surface : c.surfaceMuted,
        }}
      >
        {Icon ? <Icon color={c.textTertiary} size={18} /> : null}
        {prefix ? (
          <AppText variant="bodyStrong" tone="secondary">
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          placeholderTextColor={c.textTertiary}
          selectionColor={c.brand}
          editable={editable}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            typography.body,
            {
              flex: 1,
              color: c.text,
              paddingVertical: spacing.md,
              minHeight: rest.multiline ? 88 : undefined,
              textAlignVertical: rest.multiline ? 'top' : 'center',
            },
            style,
          ]}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" tone="negative">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="tertiary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
