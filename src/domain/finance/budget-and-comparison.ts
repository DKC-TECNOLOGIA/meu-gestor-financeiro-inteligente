import { CategoryRow, TransactionRow } from '@/types/database.types';
import { fromCents, toCents } from '@/utils/currency';
import {
  calculateMonthlyMetrics,
  DeterministicMonthlyMetrics,
} from './cashflow-calculator';

export type BudgetAlertLevel = 'unconfigured' | 'within_budget' | 'warning' | 'exceeded';

export interface CategoryBudgetStatus {
  categoryId: string;
  categoryName: string;
  colorHex: string;
  icon: string;
  monthlyBudget: number | null;
  alertThresholdPercent: number;
  spentCompetenceAmount: number;
  remainingBudgetAmount: number | null;
  usagePercent: number | null;
  alertLevel: BudgetAlertLevel;
  transactionCount: number;
  transactionIds: string[];
}

export interface CategoryMonthlyVariationItem {
  categoryId: string;
  categoryName: string;
  currentMonthAmount: number;
  previousMonthAmount: number;
  absoluteDelta: number;
  percentDelta: number | null;
}

export interface MonthlyComparisonSummary {
  currentMonth: DeterministicMonthlyMetrics;
  previousMonth: DeterministicMonthlyMetrics;
  incomeDelta: number;
  incomeDeltaPercent: number | null;
  expensesCashDelta: number;
  expensesCashDeltaPercent: number | null;
  competenceExpensesDelta: number;
  competenceExpensesDeltaPercent: number | null;
  topIncreases: CategoryMonthlyVariationItem[];
  topReductions: CategoryMonthlyVariationItem[];
}

export interface RecurringExpenseGroup {
  normalizedDescription: string;
  categoryId: string | null;
  occurrencesCount: number;
  latestAmount: number;
  averageAmount: number;
  isExplicitlyRecurring: boolean;
}

/**
 * Calcula o status de orçamento mensal por categoria (Seção 5 e Seção 8).
 * Considera as despesas por regime de competência do mês (incluindo cartão de crédito,
 * sem duplicar o pagamento da fatura e sem incluir transferências).
 */
export function evaluateCategoryBudgets(
  categories: readonly Pick<
    CategoryRow,
    | 'id'
    | 'name'
    | 'kind'
    | 'color_hex'
    | 'icon'
    | 'monthly_budget'
    | 'alert_threshold_percent'
  >[],
  transactions: readonly Pick<
    TransactionRow,
    | 'id'
    | 'category_id'
    | 'subcategory_id'
    | 'kind'
    | 'amount'
    | 'competence_date'
    | 'status'
  >[],
  referenceYearMonth: string,
): CategoryBudgetStatus[] {
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const spendByCatCents = new Map<string, number>();
  const txIdsByCat = new Map<string, string[]>();

  for (const tx of transactions) {
    if (
      tx.kind !== 'expense' ||
      tx.status === 'canceled' ||
      !tx.competence_date.startsWith(referenceYearMonth)
    ) {
      continue;
    }

    const catId = tx.category_id;
    if (!catId) continue;

    const currentCents = spendByCatCents.get(catId) ?? 0;
    spendByCatCents.set(catId, currentCents + toCents(tx.amount));

    const existingIds = txIdsByCat.get(catId) ?? [];
    existingIds.push(tx.id);
    txIdsByCat.set(catId, existingIds);
  }

  return expenseCategories
    .map((cat): CategoryBudgetStatus => {
      const spentCents = spendByCatCents.get(cat.id) ?? 0;
      const spentAmount = fromCents(spentCents);
      const txIds = txIdsByCat.get(cat.id) ?? [];

      if (cat.monthly_budget == null || cat.monthly_budget <= 0) {
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          colorHex: cat.color_hex,
          icon: cat.icon,
          monthlyBudget: null,
          alertThresholdPercent: cat.alert_threshold_percent,
          spentCompetenceAmount: spentAmount,
          remainingBudgetAmount: null,
          usagePercent: null,
          alertLevel: 'unconfigured',
          transactionCount: txIds.length,
          transactionIds: txIds,
        };
      }

      const budgetCents = toCents(cat.monthly_budget);
      const remainingCents = budgetCents - spentCents;
      const usagePercent = Number(((spentCents / budgetCents) * 100).toFixed(2));

      let alertLevel: BudgetAlertLevel = 'within_budget';
      if (spentCents > budgetCents) {
        alertLevel = 'exceeded';
      } else if (usagePercent >= cat.alert_threshold_percent) {
        alertLevel = 'warning';
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        colorHex: cat.color_hex,
        icon: cat.icon,
        monthlyBudget: cat.monthly_budget,
        alertThresholdPercent: cat.alert_threshold_percent,
        spentCompetenceAmount: spentAmount,
        remainingBudgetAmount: fromCents(remainingCents),
        usagePercent,
        alertLevel,
        transactionCount: txIds.length,
        transactionIds: txIds,
      };
    })
    .sort((a, b) => b.spentCompetenceAmount - a.spentCompetenceAmount);
}

function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  const diffCents = toCents(current) - toCents(previous);
  return Number(((diffCents / toCents(previous)) * 100).toFixed(2));
}

/**
 * Compara o mês atual contra o mês anterior e identifica os principais aumentos
 * e reduções por categoria (Seção 8).
 */
export function compareMonthlyPerformance(
  categories: readonly Pick<
    CategoryRow,
    | 'id'
    | 'name'
    | 'kind'
    | 'color_hex'
    | 'icon'
    | 'monthly_budget'
    | 'alert_threshold_percent'
  >[],
  transactions: readonly Pick<
    TransactionRow,
    | 'id'
    | 'category_id'
    | 'subcategory_id'
    | 'kind'
    | 'amount'
    | 'competence_date'
    | 'settlement_date'
    | 'payment_method'
    | 'status'
    | 'is_fixed'
  >[],
  currentYearMonth: string,
  previousYearMonth: string,
): MonthlyComparisonSummary {
  const currentMonth = calculateMonthlyMetrics(transactions, currentYearMonth);
  const previousMonth = calculateMonthlyMetrics(transactions, previousYearMonth);

  const currentBudgets = evaluateCategoryBudgets(
    categories,
    transactions,
    currentYearMonth,
  );
  const previousBudgets = evaluateCategoryBudgets(
    categories,
    transactions,
    previousYearMonth,
  );

  const prevMap = new Map<string, number>();
  for (const item of previousBudgets) {
    prevMap.set(item.categoryId, item.spentCompetenceAmount);
  }

  const variations: CategoryMonthlyVariationItem[] = [];
  for (const curr of currentBudgets) {
    const prevAmount = prevMap.get(curr.categoryId) ?? 0;
    const currAmount = curr.spentCompetenceAmount;
    if (currAmount === 0 && prevAmount === 0) continue;

    const deltaCents = toCents(currAmount) - toCents(prevAmount);
    variations.push({
      categoryId: curr.categoryId,
      categoryName: curr.categoryName,
      currentMonthAmount: currAmount,
      previousMonthAmount: prevAmount,
      absoluteDelta: fromCents(deltaCents),
      percentDelta: computeDeltaPercent(currAmount, prevAmount),
    });
  }

  const topIncreases = variations
    .filter((v) => v.absoluteDelta > 0)
    .sort((a, b) => b.absoluteDelta - a.absoluteDelta)
    .slice(0, 5);

  const topReductions = variations
    .filter((v) => v.absoluteDelta < 0)
    .sort((a, b) => a.absoluteDelta - b.absoluteDelta)
    .slice(0, 5);

  return {
    currentMonth,
    previousMonth,
    incomeDelta: fromCents(
      toCents(currentMonth.incomeReceived) - toCents(previousMonth.incomeReceived),
    ),
    incomeDeltaPercent: computeDeltaPercent(
      currentMonth.incomeReceived,
      previousMonth.incomeReceived,
    ),
    expensesCashDelta: fromCents(
      toCents(currentMonth.expensesPaidCash) - toCents(previousMonth.expensesPaidCash),
    ),
    expensesCashDeltaPercent: computeDeltaPercent(
      currentMonth.expensesPaidCash,
      previousMonth.expensesPaidCash,
    ),
    competenceExpensesDelta: fromCents(
      toCents(currentMonth.competenceExpensesTotal) -
        toCents(previousMonth.competenceExpensesTotal),
    ),
    competenceExpensesDeltaPercent: computeDeltaPercent(
      currentMonth.competenceExpensesTotal,
      previousMonth.competenceExpensesTotal,
    ),
    topIncreases,
    topReductions,
  };
}

/**
 * Identifica despesas recorrentes (explícitas via `is_recurring` ou detectadas por
 * repetição da descrição normalizada em múltiplos meses/lançamentos).
 */
export function detectRecurringExpenses(
  transactions: readonly Pick<
    TransactionRow,
    | 'description'
    | 'category_id'
    | 'kind'
    | 'amount'
    | 'competence_date'
    | 'is_recurring'
    | 'status'
  >[],
): RecurringExpenseGroup[] {
  const grouped = new Map<
    string,
    {
      categoryId: string | null;
      amountsCents: number[];
      latestDate: string;
      latestAmountCents: number;
      explicitRecurring: boolean;
    }
  >();

  for (const tx of transactions) {
    if (tx.kind !== 'expense' || tx.status === 'canceled') continue;
    const normDesc = tx.description.trim().toLowerCase().replace(/\s+/g, ' ');
    const existing = grouped.get(normDesc);
    const amountCents = toCents(tx.amount);

    if (!existing) {
      grouped.set(normDesc, {
        categoryId: tx.category_id,
        amountsCents: [amountCents],
        latestDate: tx.competence_date,
        latestAmountCents: amountCents,
        explicitRecurring: tx.is_recurring,
      });
    } else {
      existing.amountsCents.push(amountCents);
      if (tx.competence_date >= existing.latestDate) {
        existing.latestDate = tx.competence_date;
        existing.latestAmountCents = amountCents;
      }
      if (tx.is_recurring) {
        existing.explicitRecurring = true;
      }
    }
  }

  const results: RecurringExpenseGroup[] = [];
  for (const [normalizedDescription, data] of grouped.entries()) {
    if (data.explicitRecurring || data.amountsCents.length >= 2) {
      const sumCents = data.amountsCents.reduce((a, b) => a + b, 0);
      const avgCents = Math.round(sumCents / data.amountsCents.length);
      results.push({
        normalizedDescription,
        categoryId: data.categoryId,
        occurrencesCount: data.amountsCents.length,
        latestAmount: fromCents(data.latestAmountCents),
        averageAmount: fromCents(avgCents),
        isExplicitlyRecurring: data.explicitRecurring,
      });
    }
  }

  return results.sort((a, b) => b.latestAmount - a.latestAmount);
}
