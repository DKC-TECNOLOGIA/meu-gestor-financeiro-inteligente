import { View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { AppText } from './AppText';
import { spacing, useThemeColors } from './theme';

export function BrandMark({
  size = 40,
  onDark,
}: {
  size?: number;
  onDark?: boolean;
}) {
  const themeMode = useFinanceStore((s) => s.themeMode);
  const c = useThemeColors();
  const isDark = onDark ?? themeMode === 'dark';
  return (
    <Svg width={size} height={size} viewBox="1 2 120 120" fill="none">
      <Path
        d="M76 30.8 A36 36 0 1 0 89.2 80"
        stroke={isDark ? '#F1F7F3' : '#166534'}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Path
        d="M58 62 H74 L100 32"
        stroke={c.accent}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BrandLogo({
  size = 40,
  onDark,
  style,
}: {
  size?: number;
  onDark?: boolean;
  style?: ViewStyle;
}) {
  const scale = size / 40;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }, style]}>
      <BrandMark size={size} onDark={onDark} />
      <View>
        <AppText
          tone={onDark ? 'onDeep' : 'default'}
          style={{
            fontSize: 18 * scale,
            lineHeight: 22 * scale,
            fontWeight: '700',
            letterSpacing: -0.4,
          }}
        >
          Meu Gestor
        </AppText>
        <AppText
          tone={onDark ? 'onDeepMuted' : 'secondary'}
          style={{ fontSize: 12.5 * scale, lineHeight: 16 * scale }}
        >
          Financeiro Inteligente
        </AppText>
      </View>
    </View>
  );
}
