import { Text, TextProps, TextStyle } from 'react-native';
import { typography, TypographyVariant, useThemeColors } from './theme';

type Tone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'brand'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'onDeep'
  | 'onDeepMuted';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  tone = 'default',
  align,
  style,
  ...rest
}: AppTextProps) {
  const c = useThemeColors();
  const toneColor: Record<Tone, string> = {
    default: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    brand: c.brand,
    positive: c.positive,
    negative: c.negative,
    warning: c.warning,
    onDeep: c.textOnDeep,
    onDeepMuted: c.textOnDeepMuted,
  };

  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: toneColor[tone] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
