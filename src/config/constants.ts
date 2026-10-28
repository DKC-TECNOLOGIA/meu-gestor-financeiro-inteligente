import { CategoryKindType, FinancialObjectiveType } from '@/types/database.types';

export const APP_LOCALE = 'pt-BR' as const;
export const APP_CURRENCY = 'BRL' as const;
export const APP_TIMEZONE = 'America/Bahia' as const;

export interface SystemCategoryDefinition {
  slug: string;
  name: string;
  kind: CategoryKindType;
  icon: string;
  colorHex: string;
  isFixedExpenseDefault: boolean;
  isEssential: boolean;
}

/**
 * As 19 categorias iniciais exigidas na Seção 5 do projeto.
 */
export const INITIAL_SYSTEM_CATEGORIES: readonly SystemCategoryDefinition[] = [
  {
    slug: 'moradia',
    name: 'Moradia',
    kind: 'expense',
    icon: 'home',
    colorHex: '#1E40AF',
    isFixedExpenseDefault: true,
    isEssential: true,
  },
  {
    slug: 'alimentacao',
    name: 'Alimentação',
    kind: 'expense',
    icon: 'utensils',
    colorHex: '#EA580C',
    isFixedExpenseDefault: false,
    isEssential: true,
  },
  {
    slug: 'supermercado',
    name: 'Supermercado',
    kind: 'expense',
    icon: 'shopping-cart',
    colorHex: '#16A34A',
    isFixedExpenseDefault: false,
    isEssential: true,
  },
  {
    slug: 'almoco-refeicoes-fora',
    name: 'Almoço e refeições fora de casa',
    kind: 'expense',
    icon: 'coffee',
    colorHex: '#D97706',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'transporte',
    name: 'Transporte',
    kind: 'expense',
    icon: 'bus',
    colorHex: '#2563EB',
    isFixedExpenseDefault: false,
    isEssential: true,
  },
  {
    slug: 'combustivel',
    name: 'Combustível',
    kind: 'expense',
    icon: 'fuel',
    colorHex: '#4F46E5',
    isFixedExpenseDefault: false,
    isEssential: true,
  },
  {
    slug: 'saude',
    name: 'Saúde',
    kind: 'expense',
    icon: 'heart-pulse',
    colorHex: '#DC2626',
    isFixedExpenseDefault: false,
    isEssential: true,
  },
  {
    slug: 'educacao',
    name: 'Educação',
    kind: 'expense',
    icon: 'graduation-cap',
    colorHex: '#7C3AED',
    isFixedExpenseDefault: true,
    isEssential: true,
  },
  {
    slug: 'lazer',
    name: 'Lazer',
    kind: 'expense',
    icon: 'smile',
    colorHex: '#EC4899',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'assinaturas',
    name: 'Assinaturas',
    kind: 'expense',
    icon: 'tv',
    colorHex: '#9333EA',
    isFixedExpenseDefault: true,
    isEssential: false,
  },
  {
    slug: 'cartao-de-credito',
    name: 'Cartão de crédito',
    kind: 'expense',
    icon: 'credit-card',
    colorHex: '#475569',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'emprestimos-e-dividas',
    name: 'Empréstimos e dívidas',
    kind: 'expense',
    icon: 'landmark',
    colorHex: '#B91C1C',
    isFixedExpenseDefault: true,
    isEssential: true,
  },
  {
    slug: 'investimentos',
    name: 'Investimentos',
    kind: 'transfer',
    icon: 'trending-up',
    colorHex: '#059669',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'impostos',
    name: 'Impostos',
    kind: 'expense',
    icon: 'file-text',
    colorHex: '#64748B',
    isFixedExpenseDefault: false,
    isEssential: true,
  },
  {
    slug: 'compras-pessoais',
    name: 'Compras pessoais',
    kind: 'expense',
    icon: 'shopping-bag',
    colorHex: '#DB2777',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'receitas-salariais',
    name: 'Receitas salariais',
    kind: 'income',
    icon: 'briefcase',
    colorHex: '#15803D',
    isFixedExpenseDefault: true,
    isEssential: true,
  },
  {
    slug: 'renda-extra',
    name: 'Renda extra',
    kind: 'income',
    icon: 'plus-circle',
    colorHex: '#0D9488',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'outras-receitas',
    name: 'Outras receitas',
    kind: 'income',
    icon: 'arrow-down-left',
    colorHex: '#10B981',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
  {
    slug: 'outras-despesas',
    name: 'Outras despesas',
    kind: 'expense',
    icon: 'arrow-up-right',
    colorHex: '#6B7280',
    isFixedExpenseDefault: false,
    isEssential: false,
  },
] as const;

export interface FinancialObjectiveOption {
  value: FinancialObjectiveType;
  label: string;
  description: string;
}

/**
 * Os 10 objetivos financeiros do Onboarding (Seção 4).
 */
export const FINANCIAL_OBJECTIVE_OPTIONS: readonly FinancialObjectiveOption[] = [
  {
    value: 'exit_debt',
    label: 'Sair das dívidas',
    description: 'Organizar parcelas atrasadas ou renegociar compromissos financeiros.',
  },
  {
    value: 'stop_overdraft',
    label: 'Parar de utilizar o cheque especial',
    description: 'Equilibrar o fluxo de caixa mensal para eliminar juros rotativos.',
  },
  {
    value: 'emergency_fund',
    label: 'Montar uma reserva de emergência',
    description: 'Acumular de 3 a 6 meses do custo de vida em liquidez segura.',
  },
  {
    value: 'monthly_savings',
    label: 'Poupar mensalmente',
    description: 'Criar o hábito consistente de separar parte da renda todo mês.',
  },
  {
    value: 'start_investing',
    label: 'Começar a investir',
    description: 'Dar os primeiros passos em aportes regulares com segurança.',
  },
  {
    value: 'buy_house',
    label: 'Comprar uma casa',
    description: 'Planejar entrada, documentação e capacidade de financiamento.',
  },
  {
    value: 'buy_vehicle',
    label: 'Comprar um veículo',
    description: 'Acumular recursos e prever os custos de manutenção e impostos.',
  },
  {
    value: 'family_budget',
    label: 'Organizar o orçamento familiar',
    description: 'Entender para onde vai o dinheiro da casa e definir limites por categoria.',
  },
  {
    value: 'reduce_unnecessary_expenses',
    label: 'Reduzir gastos desnecessários',
    description: 'Identificar desperdícios, assinaturas esquecidas e aumentos de preços.',
  },
  {
    value: 'custom',
    label: 'Outro objetivo personalizado',
    description: 'Definir uma meta própria com valor e prazo personalizados.',
  },
] as const;
