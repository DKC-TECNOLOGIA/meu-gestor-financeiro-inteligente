import { View } from 'react-native';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Briefcase,
  Bus,
  CircleDollarSign,
  CirclePlus,
  Coffee,
  CreditCard,
  FileText,
  Fuel,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  ShoppingBag,
  ShoppingCart,
  Smile,
  TrendingUp,
  Tv,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';
import type { TransactionKindType } from '@/types/database.types';

/** Mapa dos nomes de ícone salvos em `categories.icon` (padrão Lucide kebab-case). */
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  home: House,
  house: House,
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  coffee: Coffee,
  bus: Bus,
  fuel: Fuel,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  smile: Smile,
  tv: Tv,
  'credit-card': CreditCard,
  landmark: Landmark,
  'trending-up': TrendingUp,
  'file-text': FileText,
  briefcase: Briefcase,
  'arrow-down-left': ArrowDownLeft,
  'arrow-up-right': ArrowUpRight,
  'plus-circle': CirclePlus,
};

export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICON_MAP[name]) || CircleDollarSign;
}

/** Converte `#RRGGBB` em cor translúcida para o fundo do ícone. */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return `rgba(22, 101, 52, ${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Ícone de categoria em círculo com a cor da categoria suavizada. */
export function CategoryIcon({
  icon,
  colorHex,
  size = 40,
}: {
  icon: string | null | undefined;
  colorHex: string | null | undefined;
  size?: number;
}) {
  const Icon = resolveCategoryIcon(icon);
  const color = colorHex ?? '#166534';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint(color, 0.12),
      }}
    >
      <Icon color={color} size={Math.round(size * 0.48)} strokeWidth={2} />
    </View>
  );
}

/** Ícone para lançamentos sem categoria (transferência / pagamento de fatura). */
export function TransactionKindIcon({ kind, size = 40 }: { kind: TransactionKindType; size?: number }) {
  if (kind === 'transfer') {
    return <CategoryIcon icon={null} colorHex="#0F766E" size={size} />;
  }
  if (kind === 'invoice_payment') {
    return <CategoryIcon icon="credit-card" colorHex="#475569" size={size} />;
  }
  return <CategoryIcon icon={kind === 'income' ? 'arrow-down-left' : 'arrow-up-right'} colorHex="#166534" size={size} />;
}

export const TransferIcon = ArrowLeftRight;
