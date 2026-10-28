import {
  CategoryRow,
  FinancialGoalRow,
  GamificationEventRow,
  GamificationLevelType,
  TransactionRow,
} from '@/types/database.types';
import { evaluateCategoryBudgets } from '@/domain/finance/budget-and-comparison';

export interface GamificationLevelDescriptor {
  level: GamificationLevelType;
  order: 1 | 2 | 3 | 4;
  title: string;
  minPoints: number;
  nextLevelPoints: number | null;
  description: string;
}

export const GAMIFICATION_LEVELS: readonly GamificationLevelDescriptor[] = [
  {
    level: 'iniciante',
    order: 1,
    title: '1. Iniciante',
    minPoints: 0,
    nextLevelPoints: 200,
    description:
      'Começando a organizar receitas, despesas e tomar consciência do orçamento mensal.',
  },
  {
    level: 'consciente',
    order: 2,
    title: '2. Consciente',
    minPoints: 200,
    nextLevelPoints: 600,
    description:
      'Registra gastos com regularidade, acompanha categorias e compara preços antes de comprar.',
  },
  {
    level: 'disciplinado',
    order: 3,
    title: '3. Disciplinado',
    minPoints: 600,
    nextLevelPoints: 1500,
    description:
      'Cumpre orçamentos mensais, reduz dívidas e mantém constância nas metas e na reserva.',
  },
  {
    level: 'estrategico',
    order: 4,
    title: '4. Estratégico',
    minPoints: 1500,
    nextLevelPoints: null,
    description:
      'Domina o planejamento de longo prazo com hábitos financeiros sólidos e consistentes.',
  },
] as const;

export interface CandidateGamificationEvent {
  ruleCode:
    | 'REGULAR_RECORDING_WEEK'
    | 'BUDGET_DISCIPLINE_MONTH'
    | 'GOAL_CONTRIBUTION_PROGRESS'
    | 'DEBT_REDUCTION_ACTION'
    | 'EMERGENCY_FUND_HABIT'
    | 'RECEIPT_PRICE_AUDIT';
  reasonDescription: string;
  pointsDelta: number;
  referenceMonth: string; // YYYY-MM-01
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}

/**
 * Determina o nível de responsabilidade financeira com base na pontuação acumulada.
 * Requisito Seção 12:
 * - Os níveis refletem hábitos e evolução pessoal, não constituem diagnóstico oficial de saúde financeira.
 */
export function resolveGamificationLevel(
  totalPoints: number,
): GamificationLevelDescriptor {
  const safePoints = Math.max(0, Math.floor(totalPoints));
  if (safePoints >= 1500) return GAMIFICATION_LEVELS[3]!;
  if (safePoints >= 600) return GAMIFICATION_LEVELS[2]!;
  if (safePoints >= 200) return GAMIFICATION_LEVELS[1]!;
  return GAMIFICATION_LEVELS[0]!;
}

/**
 * Avalia de forma 100% determinística e justa os eventos de gamificação elegíveis no mês (Seção 12):
 * - Considera: regularidade dos registros, cumprimento de orçamento, evolução em metas,
 *   redução de dívidas, formação de reserva e hábitos consistentes.
 * - NÃO recompensa risco elevado nem renda alta (pontuação independe do valor absoluto da renda).
 * - NÃO penaliza despesas essenciais (`is_essential = true`), emergências ou impossibilidade de poupar.
 * - Usa `idempotencyKey` determinística para impedir duplicação ou manipulação no histórico.
 */
export function evaluateMonthlyGamificationEvents(params: {
  userId: string;
  referenceYearMonth: string; // 'YYYY-MM'
  categories: readonly CategoryRow[];
  transactions: readonly TransactionRow[];
  goals: readonly FinancialGoalRow[];
  existingEvents: readonly GamificationEventRow[];
  receiptsCountInMonth?: number;
}): CandidateGamificationEvent[] {
  const {
    referenceYearMonth,
    categories,
    transactions,
    goals,
    existingEvents,
    receiptsCountInMonth = 0,
  } = params;

  const existingKeys = new Set(existingEvents.map((e) => e.idempotency_key));
  const referenceMonthDate = `${referenceYearMonth}-01`;
  const newEvents: CandidateGamificationEvent[] = [];

  const monthTx = transactions.filter(
    (t) =>
      t.status !== 'canceled' && t.competence_date.startsWith(referenceYearMonth),
  );

  // 1. Regularidade dos registros (pelo menos 3 lançamentos registrados no mês)
  if (monthTx.length >= 3) {
    const key = `REGULAR_RECORDING_WEEK:${referenceYearMonth}:min3`;
    if (!existingKeys.has(key)) {
      newEvents.push({
        ruleCode: 'REGULAR_RECORDING_WEEK',
        reasonDescription: `Regularidade nos registros: ${monthTx.length} lançamentos organizados em ${referenceYearMonth}.`,
        pointsDelta: 40,
        referenceMonth: referenceMonthDate,
        idempotencyKey: key,
        metadata: { transactionsCount: monthTx.length },
      });
    }
  }

  // 2. Cumprimento de orçamento em categorias NÃO essenciais (nunca penaliza categorias essenciais/emergências)
  const budgets = evaluateCategoryBudgets(categories, monthTx, referenceYearMonth);
  const configuredBudgets = budgets.filter((b) => b.monthlyBudget != null);
  const nonEssentialCatIds = new Set(
    categories.filter((c) => !c.is_essential).map((c) => c.id),
  );
  const respectedDiscretionaryBudgets = configuredBudgets.filter(
    (b) =>
      nonEssentialCatIds.has(b.categoryId) &&
      (b.alertLevel === 'within_budget' || b.alertLevel === 'warning'),
  );

  if (respectedDiscretionaryBudgets.length > 0) {
    const key = `BUDGET_DISCIPLINE_MONTH:${referenceYearMonth}`;
    if (!existingKeys.has(key)) {
      newEvents.push({
        ruleCode: 'BUDGET_DISCIPLINE_MONTH',
        reasonDescription: `Cumprimento de orçamento mensal em ${respectedDiscretionaryBudgets.length} categoria(s) planejada(s).`,
        pointsDelta: 60,
        referenceMonth: referenceMonthDate,
        idempotencyKey: key,
        metadata: {
          categoriesWithinBudget: respectedDiscretionaryBudgets.map(
            (b) => b.categoryName,
          ),
        },
      });
    }
  }

  // 3. Evolução em metas financeiras (qualquer meta ativa com progresso positivo, independente do valor da renda)
  const activeGoalsWithProgress = goals.filter(
    (g) => g.status === 'active' && g.current_amount > 0,
  );
  if (activeGoalsWithProgress.length > 0) {
    const key = `GOAL_CONTRIBUTION_PROGRESS:${referenceYearMonth}`;
    if (!existingKeys.has(key)) {
      newEvents.push({
        ruleCode: 'GOAL_CONTRIBUTION_PROGRESS',
        reasonDescription: `Evolução consistente em ${activeGoalsWithProgress.length} meta(s) financeira(s).`,
        pointsDelta: 50,
        referenceMonth: referenceMonthDate,
        idempotencyKey: key,
        metadata: { activeGoalsCount: activeGoalsWithProgress.length },
      });
    }
  }

  // 4. Redução de dívidas (pagamento em dia na categoria 'emprestimos-e-dividas' ou meta 'exit_debt')
  const debtCat = categories.find((c) => c.slug === 'emprestimos-e-dividas');
  const paidDebtTx = monthTx.filter(
    (t) =>
      t.kind === 'expense' &&
      t.status === 'paid' &&
      debtCat &&
      t.category_id === debtCat.id,
  );
  if (paidDebtTx.length > 0) {
    const key = `DEBT_REDUCTION_ACTION:${referenceYearMonth}`;
    if (!existingKeys.has(key)) {
      newEvents.push({
        ruleCode: 'DEBT_REDUCTION_ACTION',
        reasonDescription:
          'Compromisso com redução de dívidas: parcelas ou encargos quitados em dia no período.',
        pointsDelta: 55,
        referenceMonth: referenceMonthDate,
        idempotencyKey: key,
        metadata: { debtPaymentsCount: paidDebtTx.length },
      });
    }
  }

  // 5. Formação de reserva de emergência (meta 'emergency_fund' ativa ou transferência para reserva)
  const hasEmergencyGoalProgress = goals.some(
    (g) => g.objective_type === 'emergency_fund' && g.current_amount > 0,
  );
  const hasTransferToReserve = monthTx.some((t) => t.kind === 'transfer');
  if (hasEmergencyGoalProgress || hasTransferToReserve) {
    const key = `EMERGENCY_FUND_HABIT:${referenceYearMonth}`;
    if (!existingKeys.has(key)) {
      newEvents.push({
        ruleCode: 'EMERGENCY_FUND_HABIT',
        reasonDescription:
          'Hábito de proteção financeira: construção ou manutenção da reserva de emergência.',
        pointsDelta: 50,
        referenceMonth: referenceMonthDate,
        idempotencyKey: key,
        metadata: { hasEmergencyGoalProgress, hasTransferToReserve },
      });
    }
  }

  // 6. Hábito de auditoria de preços via nota fiscal (NFC-e)
  if (receiptsCountInMonth > 0) {
    const key = `RECEIPT_PRICE_AUDIT:${referenceYearMonth}`;
    if (!existingKeys.has(key)) {
      newEvents.push({
        ruleCode: 'RECEIPT_PRICE_AUDIT',
        reasonDescription:
          'Consumo consciente: importação de nota fiscal para acompanhamento e comparação de preços.',
        pointsDelta: 35,
        referenceMonth: referenceMonthDate,
        idempotencyKey: key,
        metadata: { receiptsCountInMonth },
      });
    }
  }

  return newEvents;
}
