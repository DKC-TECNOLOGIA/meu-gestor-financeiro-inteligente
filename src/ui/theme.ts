/**
 * Design tokens — Meu Gestor Financeiro Inteligente.
 * Suporta Modo Claro (`light`) e Modo Escuro (`dark` — estética Vault Forest).
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';

export interface ColorPalette {
  brand: string;
  brandPressed: string;
  brandDeep: string;
  brandDeepRaised: string;
  brandSoft: string;
  accent: string;
  accentOnDeep: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textOnDeep: string;
  textOnDeepMuted: string;
  positive: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  successSoft: string;
  overlay: string;
}

export const lightColors: ColorPalette = {
  brand: '#166534',
  brandPressed: '#14532D',
  brandDeep: '#0B3D2C',
  brandDeepRaised: '#13503A',
  brandSoft: '#E7F3EC',
  accent: '#22C55E',
  accentOnDeep: '#4ADE80',
  background: '#F6F8F7',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F4F2',
  border: '#E3E8E5',
  borderStrong: '#CBD5D0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textOnDeep: '#FFFFFF',
  textOnDeepMuted: '#A7C4B5',
  positive: '#15803D',
  negative: '#DC2626',
  negativeSoft: '#FEF2F2',
  warning: '#A16207',
  warningSoft: '#FEF9C3',
  info: '#0F766E',
  infoSoft: '#F0FDFA',
  successSoft: '#ECFDF3',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const darkColors: ColorPalette = {
  brand: '#22C55E',
  brandPressed: '#16A34A',
  brandDeep: '#0B3D2C',
  brandDeepRaised: '#14523B',
  brandSoft: '#133829',
  accent: '#4ADE80',
  accentOnDeep: '#4ADE80',
  background: '#061710',
  surface: '#0D261C',
  surfaceMuted: '#133527',
  border: '#1D4635',
  borderStrong: '#285E47',
  text: '#F1F7F3',
  textSecondary: '#9BB8A9',
  textTertiary: '#6B8E7D',
  textOnDeep: '#FFFFFF',
  textOnDeepMuted: '#A7C4B5',
  positive: '#4ADE80',
  negative: '#F87171',
  negativeSoft: '#3B1219',
  warning: '#FACC15',
  warningSoft: '#362B09',
  info: '#2DD4BF',
  infoSoft: '#0D3330',
  successSoft: '#0F3624',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

export const colors: ColorPalette = lightColors;

/** Retorna a paleta ativa (`light` ou `dark`) reagindo ao `themeMode` do store. */
export function useThemeColors(): ColorPalette {
  const themeMode = useFinanceStore((s) => s.themeMode);
  return themeMode === 'dark' ? darkColors : lightColors;
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  display: { fontSize: 36, lineHeight: 42, fontWeight: '300', letterSpacing: -0.8, ...tabular },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  amount: { fontSize: 15, lineHeight: 20, fontWeight: '600', ...tabular },
  amountLarge: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3, ...tabular },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const elevation: ViewStyle = Platform.select<ViewStyle>({
  android: { elevation: 3 },
  default: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
}) as ViewStyle;

export const touchTarget = 48;

export const theme = { colors, spacing, radius, typography, elevation, touchTarget };
export type Theme = typeof theme;
