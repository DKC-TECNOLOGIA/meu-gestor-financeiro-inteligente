import { TransactionRow } from '@/types/database.types';
import { fromCents, toCents } from '@/utils/currency';

export interface DeterministicMonthlyMetrics {
  referenceMonth: string;
  /** Receitas efetivamente recebidas no mês (Fluxo de Caixa) */
  incomeReceived: number;
  /** Despesas efetivamente pagas no mês + faturas quitadas (Fluxo de Caixa) */
  expensesPaidCash: number;
  /** Saldo de caixa do período (incomeReceived - expensesPaidCash) */
  cashFlowBalance: number;
  /** Total de gastos do mês por competência (inclui compras no cartão; exclui pagamento de fatura e transferências) */
  competenceExpensesTotal: number;
  /** Resultado econômico por competência (incomeReceived - competenceExpensesTotal) */
  competenceResult: number;
  /** Despesas fixas na competência */
  fixedExpensesTotal: number;
  /** Despesas variáveis na competência */
  variableExpensesTotal: number;
  /** Compras no cartão de crédito na competência (sem somar o pagamento da fatura) */
  creditCardSpendTotal: number;
  /** Pagamentos de faturas de cartão realizados no mês (caixa) */
  invoicePaymentsTotal: number;
  /** Transferências entre contas próprias (neutras no resultado) */
  internalTransfersTotal: number;
  /** Taxa de poupança em % (ou null quando não há receita recebida no período) */
  savingsRatePercent: number | null;
}

function isWithinMonth(dateStr: string | null, referenceYearMonth: string): boolean {
  if (!dateStr) return false;
  return dateStr.startsWith(referenceYearMonth);
}

/**
 * Calcula de forma 100% determinística os indicadores do mês (Seção 5, 8 e 11):
 * - Diferencia compras no cartão de crédito, faturas e pagamentos de faturas para evitar dupla contagem.
 * - Não considera transferência entre contas próprias como receita ou despesa.
 */
export function calculateMonthlyMetrics(
  transactions: readonly Pick<
    TransactionRow,
    | 'kind'
    | 'amount'
    | 'competence_date'
    | 'settlement_date'
    | 'payment_method'
    | 'status'
    | 'is_fixed'
  >[],
  referenceYearMonth: string, // formato 'YYYY-MM'
): DeterministicMonthlyMetrics {
  if (!/^\d{4}-\d{2}$/.test(referenceYearMonth)) {
    throw new Error('O mês de referência deve estar no formato YYYY-MM.');
  }

  let incomeReceivedCents = 0;
  let expensesPaidCashCents = 0;
  let competenceExpensesCents = 0;
  let fixedExpensesCents = 0;
  let variableExpensesCents = 0;
  let creditCardSpendCents = 0;
  let invoicePaymentsCents = 0;
  let internalTransfersCents = 0;

  for (const tx of transactions) {
    if (tx.status === 'canceled') {
      continue;
    }

    const amountCents = toCents(tx.amount);
    const effectiveCashDate = tx.settlement_date ?? tx.competence_date;
    const isCashInMonth = isWithinMonth(effectiveCashDate, referenceYearMonth);
    const isCompetenceInMonth = isWithinMonth(tx.competence_date, referenceYearMonth);

    // 1. Transferência entre contas próprias: NUNCA é receita nem despesa
    if (tx.kind === 'transfer') {
      if (isCashInMonth || isCompetenceInMonth) {
        internalTransfersCents += amountCents;
      }
      continue;
    }

    // 2. Receitas recebidas no caixa
    if (tx.kind === 'income') {
      if (tx.status === 'received' && isCashInMonth) {
        incomeReceivedCents += amountCents;
      }
      continue;
    }

    // 3. Pagamento de fatura de cartão: impacta o Fluxo de Caixa quando pago,
    //    mas NÃO entra nas despesas de competência para evitar dupla contagem!
    if (tx.kind === 'invoice_payment') {
      if (tx.status === 'paid' && isCashInMonth) {
        invoicePaymentsCents += amountCents;
        expensesPaidCashCents += amountCents;
      }
      continue;
    }

    // 4. Despesas propriamente ditas (kind === 'expense')
    if (tx.kind === 'expense') {
      // No regime de competência, entram todas as despesas do mês (inclusive cartão de crédito)
      if (isCompetenceInMonth) {
        competenceExpensesCents += amountCents;
        if (tx.is_fixed) {
          fixedExpensesCents += amountCents;
        } else {
          variableExpensesCents += amountCents;
        }
        if (tx.payment_method === 'credit_card') {
          creditCardSpendCents += amountCents;
        }
      }

      // No fluxo de caixa, entram apenas despesas pagas que NÃO são cartão de crédito
      // (pois compras no cartão saem do caixa apenas via `invoice_payment`)
      if (
        tx.payment_method !== 'credit_card' &&
        tx.status === 'paid' &&
        isCashInMonth
      ) {
        expensesPaidCashCents += amountCents;
      }
    }
  }

  const cashFlowBalanceCents = incomeReceivedCents - expensesPaidCashCents;
  const competenceResultCents = incomeReceivedCents - competenceExpensesCents;

  const savingsRatePercent =
    incomeReceivedCents > 0
      ? Number(((cashFlowBalanceCents / incomeReceivedCents) * 100).toFixed(2))
      : null;

  return {
    referenceMonth: `${referenceYearMonth}-01`,
    incomeReceived: fromCents(incomeReceivedCents),
    expensesPaidCash: fromCents(expensesPaidCashCents),
    cashFlowBalance: fromCents(cashFlowBalanceCents),
    competenceExpensesTotal: fromCents(competenceExpensesCents),
    competenceResult: fromCents(competenceResultCents),
    fixedExpensesTotal: fromCents(fixedExpensesCents),
    variableExpensesTotal: fromCents(variableExpensesCents),
    creditCardSpendTotal: fromCents(creditCardSpendCents),
    invoicePaymentsTotal: fromCents(invoicePaymentsCents),
    internalTransfersTotal: fromCents(internalTransfersCents),
    savingsRatePercent,
  };
}
