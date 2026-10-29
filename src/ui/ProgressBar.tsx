import { View } from 'react-native';
import { radius, useThemeColors } from './theme';

export type ProgressTone = 'brand' | 'accent' | 'warning' | 'negative' | 'onDeep';

export function ProgressBar({
  value,
  tone = 'brand',
  height = 6,
  trackColor,
  accessibilityLabel,
}: {
  value: number;
  tone?: ProgressTone;
  height?: number;
  trackColor?: string;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const toneColor: Record<ProgressTone, string> = {
    brand: c.brand,
    accent: c.accent,
    warning: '#EAB308',
    negative: c.negative,
    onDeep: c.accentOnDeep,
  };
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: radius.pill,
        backgroundColor: trackColor ?? c.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: toneColor[tone],
        }}
      />
    </View>
  );
}

export function budgetTone(alertLevel: string): ProgressTone {
  if (alertLevel === 'exceeded') return 'negative';
  if (alertLevel === 'warning') return 'warning';
  return 'brand';
}
