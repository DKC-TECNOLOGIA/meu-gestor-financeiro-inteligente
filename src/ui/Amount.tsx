import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppText, AppTextProps } from './AppText';
import { radius, spacing, useThemeColors } from './theme';
import { formatCurrencyBRL } from '@/utils/currency';

export function Amount({
  value,
  kind = 'neutral',
  variant = 'amount',
  tone,
  ...rest
}: {
  value: number;
  kind?: 'income' | 'expense' | 'neutral';
} & Omit<AppTextProps, 'children'>) {
  const sign = kind === 'income' ? '+ ' : kind === 'expense' ? '− ' : '';
  const autoTone = kind === 'income' ? 'positive' : 'default';
  return (
    <AppText variant={variant} tone={tone ?? autoTone} numberOfLines={1} {...rest}>
      {sign}
      {formatCurrencyBRL(Math.abs(value))}
    </AppText>
  );
}

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function formatYearMonthLabel(yearMonth: string, short = false): string {
  const [y, m] = yearMonth.split('-');
  const name = MONTHS_PT[Number(m) - 1] ?? yearMonth;
  if (short) return `${name.slice(0, 3)} ${y ?? ''}`.trim();
  return `${name} de ${y ?? ''}`.trim();
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const base = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function MonthSwitcher({
  value,
  onChange,
  onDeep = false,
}: {
  value: string;
  onChange: (yearMonth: string) => void;
  onDeep?: boolean;
}) {
  const c = useThemeColors();
  const fg = onDeep ? c.textOnDeep : c.text;
  const btn = (dir: -1 | 1) => {
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? 'Mês anterior' : 'Próximo mês'}
        onPress={() => onChange(shiftYearMonth(value, dir))}
        hitSlop={10}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed
            ? onDeep
              ? c.brandDeepRaised
              : c.surfaceMuted
            : 'transparent',
        })}
      >
        <Icon color={fg} size={18} />
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {btn(-1)}
      <AppText
        variant="label"
        tone={onDeep ? 'onDeep' : 'default'}
        style={{ fontWeight: '600', minWidth: 120, textAlign: 'center' }}
        accessibilityLiveRegion="polite"
      >
        {formatYearMonthLabel(value)}
      </AppText>
      {btn(1)}
    </View>
  );
}
