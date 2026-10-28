import * as XLSX from 'xlsx';
import {
  CardInvoiceRow,
  CategoryRow,
  CreditCardRow,
  FinancialGoalRow,
  MonthlySummaryRow,
  ReceiptItemRow,
  ReceiptRow,
  TransactionRow,
} from '@/types/database.types';
import { formatCurrencyBRL, formatDateBR, sumCurrencyExact } from '@/utils/currency';
import { calculateMonthlyMetrics } from '@/domain/finance/cashflow-calculator';
import { evaluateCategoryBudgets } from '@/domain/finance/budget-and-comparison';

export interface ExcelExportInput {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  referenceYearMonth: string; // YYYY-MM
  userDisplayName: string;
  categories: readonly CategoryRow[];
  transactions: readonly TransactionRow[];
  creditCards?: readonly CreditCardRow[];
  cardInvoices?: readonly CardInvoiceRow[];
  financialGoals?: readonly FinancialGoalRow[];
  receipts?: readonly ReceiptRow[];
  receiptItems?: readonly ReceiptItemRow[];
  monthlySummaries?: readonly MonthlySummaryRow[];
}

export interface ExcelExportResult {
  workbook: XLSX.WorkBook;
  base64Content: string;
  sheetNames: string[];
  fileName: string;
}

/**
 * Gera um arquivo XLSX real (Seção 3 e Seção 10) com as 9 abas padronizadas:
 * 1. Resumo financeiro
 * 2. Receitas
 * 3. Despesas
 * 4. Categorias
 * 5. Compras e notas fiscais
 * 6. Itens e histórico de preços
 * 7. Cartões e faturas
 * 8. Metas financeiras
 * 9. Evolução mensal
 *
 * Nunca inclui segredos, tokens ou credenciais.
 */
export function buildFinancialExcelWorkbook(
  input: ExcelExportInput,
): ExcelExportResult {
  const wb = XLSX.utils.book_new();

  const catMap = new Map<string, string>();
  for (const cat of input.categories) {
    catMap.set(cat.id, cat.name);
  }

  const filteredTx = input.transactions.filter((tx) => {
    const refDate = tx.competence_date;
    return refDate >= input.periodStart && refDate <= input.periodEnd;
  });

  const metrics = calculateMonthlyMetrics(filteredTx, input.referenceYearMonth);

  // 1. Aba: Resumo financeiro
  const summaryRows = [
    {
      Indicador: 'Titular do Relatório',
      Valor_Numerico: null,
      Valor_Formatado: input.userDisplayName,
      Observacao: `Período: ${formatDateBR(input.periodStart)} a ${formatDateBR(input.periodEnd)}`,
    },
    {
      Indicador: 'Receitas Recebidas (Fluxo de Caixa)',
      Valor_Numerico: metrics.incomeReceived,
      Valor_Formatado: formatCurrencyBRL(metrics.incomeReceived),
      Observacao: 'Entradas efetivamente recebidas no mês de referência',
    },
    {
      Indicador: 'Despesas Pagas (Fluxo de Caixa)',
      Valor_Numerico: metrics.expensesPaidCash,
      Valor_Formatado: formatCurrencyBRL(metrics.expensesPaidCash),
      Observacao: 'Despesas à vista pagas + pagamentos de fatura de cartão',
    },
    {
      Indicador: 'Saldo de Caixa do Período',
      Valor_Numerico: metrics.cashFlowBalance,
      Valor_Formatado: formatCurrencyBRL(metrics.cashFlowBalance),
      Observacao: 'Receitas recebidas menos despesas pagas no caixa',
    },
    {
      Indicador: 'Despesas por Competência',
      Valor_Numerico: metrics.competenceExpensesTotal,
      Valor_Formatado: formatCurrencyBRL(metrics.competenceExpensesTotal),
      Observacao:
        'Inclui compras no cartão de crédito; exclui pagamento de fatura para evitar dupla contagem',
    },
    {
      Indicador: 'Total de Despesas Fixas (Competência)',
      Valor_Numerico: metrics.fixedExpensesTotal,
      Valor_Formatado: formatCurrencyBRL(metrics.fixedExpensesTotal),
      Observacao: 'Compromissos fixos do mês',
    },
    {
      Indicador: 'Total de Despesas Variáveis (Competência)',
      Valor_Numerico: metrics.variableExpensesTotal,
      Valor_Formatado: formatCurrencyBRL(metrics.variableExpensesTotal),
      Observacao: 'Gastos variáveis do mês',
    },
    {
      Indicador: 'Gastos no Cartão de Crédito (Competência)',
      Valor_Numerico: metrics.creditCardSpendTotal,
      Valor_Formatado: formatCurrencyBRL(metrics.creditCardSpendTotal),
      Observacao: 'Compras realizadas no cartão no período',
    },
    {
      Indicador: 'Transferências entre Contas Próprias',
      Valor_Numerico: metrics.internalTransfersTotal,
      Valor_Formatado: formatCurrencyBRL(metrics.internalTransfersTotal),
      Observacao: 'Neutras no resultado financeiro mensal',
    },
    {
      Indicador: 'Taxa de Poupança (%)',
      Valor_Numerico: metrics.savingsRatePercent ?? 0,
      Valor_Formatado:
        metrics.savingsRatePercent != null
          ? `${metrics.savingsRatePercent.toFixed(2)}%`
          : 'Sem dados suficientes',
      Observacao: 'Percentual poupado sobre a receita recebida',
    },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo financeiro');

  // 2. Aba: Receitas
  const incomeTx = filteredTx.filter(
    (tx) => tx.kind === 'income' && tx.status !== 'canceled',
  );
  const totalIncomes = sumCurrencyExact(incomeTx.map((t) => t.amount));
  const incomeRows = [
    ...incomeTx.map((tx) => ({
      Data_Competencia: formatDateBR(tx.competence_date),
      Data_Recebimento: tx.settlement_date ? formatDateBR(tx.settlement_date) : '-',
      Descricao: tx.description,
      Categoria: (tx.category_id && catMap.get(tx.category_id)) ?? 'Sem categoria',
      Forma_Pagamento: tx.payment_method,
      Status: tx.status,
      Origem: tx.origin,
      Valor_BRL: tx.amount,
      Valor_Formatado: formatCurrencyBRL(tx.amount),
    })),
    {
      Data_Competencia: 'TOTAL',
      Data_Recebimento: '-',
      Descricao: `Total de Receitas (${incomeTx.length} lançamentos)`,
      Categoria: '-',
      Forma_Pagamento: '-',
      Status: '-',
      Origem: '-',
      Valor_BRL: totalIncomes,
      Valor_Formatado: formatCurrencyBRL(totalIncomes),
    },
  ];
  const wsIncomes = XLSX.utils.json_to_sheet(incomeRows);
  XLSX.utils.book_append_sheet(wb, wsIncomes, 'Receitas');

  // 3. Aba: Despesas
  const expenseTx = filteredTx.filter(
    (tx) => tx.kind === 'expense' && tx.status !== 'canceled',
  );
  const totalExpenses = sumCurrencyExact(expenseTx.map((t) => t.amount));
  const expenseRows = [
    ...expenseTx.map((tx) => ({
      Data_Competencia: formatDateBR(tx.competence_date),
      Data_Pagamento: tx.settlement_date ? formatDateBR(tx.settlement_date) : '-',
      Descricao: tx.description,
      Categoria: (tx.category_id && catMap.get(tx.category_id)) ?? 'Sem categoria',
      Tipo_Gasto: tx.is_fixed ? 'Fixa' : 'Variável',
      Recorrente: tx.is_recurring ? 'Sim' : 'Não',
      Forma_Pagamento: tx.payment_method,
      Status: tx.status,
      Origem: tx.origin,
      Valor_BRL: tx.amount,
      Valor_Formatado: formatCurrencyBRL(tx.amount),
    })),
    {
      Data_Competencia: 'TOTAL',
      Data_Pagamento: '-',
      Descricao: `Total de Despesas (${expenseTx.length} lançamentos)`,
      Categoria: '-',
      Tipo_Gasto: '-',
      Recorrente: '-',
      Forma_Pagamento: '-',
      Status: '-',
      Origem: '-',
      Valor_BRL: totalExpenses,
      Valor_Formatado: formatCurrencyBRL(totalExpenses),
    },
  ];
  const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Despesas');

  // 4. Aba: Categorias
  const budgetStatuses = evaluateCategoryBudgets(
    input.categories,
    filteredTx,
    input.referenceYearMonth,
  );
  const categoryRows = budgetStatuses.map((b) => ({
    Categoria: b.categoryName,
    Orcamento_Mensal_BRL: b.monthlyBudget ?? 0,
    Orcamento_Formatado:
      b.monthlyBudget != null ? formatCurrencyBRL(b.monthlyBudget) : 'Não definido',
    Gasto_Competencia_BRL: b.spentCompetenceAmount,
    Gasto_Formatado: formatCurrencyBRL(b.spentCompetenceAmount),
    Saldo_Orcamento_BRL: b.remainingBudgetAmount ?? 0,
    Uso_Percentual: b.usagePercent != null ? `${b.usagePercent.toFixed(2)}%` : '-',
    Situacao: b.alertLevel,
    Qtd_Lancamentos: b.transactionCount,
  }));
  const wsCategories = XLSX.utils.json_to_sheet(categoryRows);
  XLSX.utils.book_append_sheet(wb, wsCategories, 'Categorias');

  // 5. Aba: Compras e notas fiscais
  const receipts = input.receipts ?? [];
  const receiptRows =
    receipts.length > 0
      ? receipts.map((r) => ({
          Data_Emissao: formatDateBR(r.issued_at),
          Estabelecimento: r.merchant_name,
          CNPJ: r.merchant_cnpj ?? '-',
          UF: r.issuer_uf,
          Chave_Acesso: r.access_key ?? '-',
          Valor_Bruto_BRL: r.total_gross_amount,
          Desconto_BRL: r.total_discount_amount,
          Valor_Pago_BRL: r.total_paid_amount,
          Valor_Pago_Formatado: formatCurrencyBRL(r.total_paid_amount),
          Status: r.status,
        }))
      : [
          {
            Data_Emissao: '-',
            Estabelecimento: 'Nenhuma nota fiscal no período selecionado',
            CNPJ: '-',
            UF: 'BA',
            Chave_Acesso: '-',
            Valor_Bruto_BRL: 0,
            Desconto_BRL: 0,
            Valor_Pago_BRL: 0,
            Valor_Pago_Formatado: formatCurrencyBRL(0),
            Status: '-',
          },
        ];
  const wsReceipts = XLSX.utils.json_to_sheet(receiptRows);
  XLSX.utils.book_append_sheet(wb, wsReceipts, 'Compras e notas fiscais');

  // 6. Aba: Itens e histórico de preços
  const receiptItems = input.receiptItems ?? [];
  const itemRows =
    receiptItems.length > 0
      ? receiptItems.map((it) => ({
          Data_Compra: formatDateBR(it.purchase_date),
          Estabelecimento: it.merchant_name,
          Produto_Original: it.original_product_name,
          Produto_Normalizado: it.normalized_product_name,
          Marca: it.brand ?? '-',
          EAN: it.ean_barcode ?? '-',
          Quantidade: it.quantity,
          Unidade: it.measurement_unit,
          Preco_Unitario_Liquido_BRL: it.unit_net_price_paid,
          Total_Pago_BRL: it.total_net_paid,
        }))
      : [
          {
            Data_Compra: '-',
            Estabelecimento: '-',
            Produto_Original: 'Nenhum item de nota fiscal registrado no período',
            Produto_Normalizado: '-',
            Marca: '-',
            EAN: '-',
            Quantidade: 0,
            Unidade: 'UN',
            Preco_Unitario_Liquido_BRL: 0,
            Total_Pago_BRL: 0,
          },
        ];
  const wsItems = XLSX.utils.json_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Itens e histórico de preços');

  // 7. Aba: Cartões e faturas
  const invoices = input.cardInvoices ?? [];
  const cardsMap = new Map<string, string>();
  for (const c of input.creditCards ?? []) {
    cardsMap.set(c.id, c.name);
  }
  const invoiceRows =
    invoices.length > 0
      ? invoices.map((inv) => ({
          Cartao: cardsMap.get(inv.credit_card_id) ?? inv.credit_card_id,
          Mes_Referencia: inv.reference_month,
          Fechamento: formatDateBR(inv.closing_date),
          Vencimento: formatDateBR(inv.due_date),
          Total_Fatura_BRL: inv.total_amount,
          Valor_Pago_BRL: inv.paid_amount,
          Status: inv.status,
        }))
      : [
          {
            Cartao: 'Nenhuma fatura registrada no período',
            Mes_Referencia: input.referenceYearMonth,
            Fechamento: '-',
            Vencimento: '-',
            Total_Fatura_BRL: 0,
            Valor_Pago_BRL: 0,
            Status: '-',
          },
        ];
  const wsInvoices = XLSX.utils.json_to_sheet(invoiceRows);
  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Cartões e faturas');

  // 8. Aba: Metas financeiras
  const goals = input.financialGoals ?? [];
  const goalRows =
    goals.length > 0
      ? goals.map((g) => ({
          Meta: g.name,
          Objetivo: g.objective_type,
          Valor_Alvo_BRL: g.target_amount,
          Valor_Atual_BRL: g.current_amount,
          Progresso_Percentual:
            g.target_amount > 0
              ? `${((g.current_amount / g.target_amount) * 100).toFixed(2)}%`
              : '0.00%',
          Prazo: g.target_date ? formatDateBR(g.target_date) : 'Sem prazo fixo',
          Status: g.status,
        }))
      : [
          {
            Meta: 'Nenhuma meta financeira ativa',
            Objetivo: '-',
            Valor_Alvo_BRL: 0,
            Valor_Atual_BRL: 0,
            Progresso_Percentual: '0.00%',
            Prazo: '-',
            Status: '-',
          },
        ];
  const wsGoals = XLSX.utils.json_to_sheet(goalRows);
  XLSX.utils.book_append_sheet(wb, wsGoals, 'Metas financeiras');

  // 9. Aba: Evolução mensal
  const summaries = input.monthlySummaries ?? [];
  const evolutionRows =
    summaries.length > 0
      ? summaries.map((s) => ({
          Mes_Referencia: s.reference_month,
          Receitas_Recebidas_BRL: s.total_income_received,
          Despesas_Pagas_Caixa_BRL: s.total_expenses_paid,
          Despesas_Competencia_BRL: s.total_competence_expenses,
          Saldo_Caixa_BRL: s.period_cash_balance,
          Taxa_Poupanca_Percentual:
            s.savings_rate_percent != null ? `${s.savings_rate_percent}%` : '-',
          Patrimonio_Liquido_BRL: s.net_worth_snapshot,
        }))
      : [
          {
            Mes_Referencia: `${input.referenceYearMonth}-01`,
            Receitas_Recebidas_BRL: metrics.incomeReceived,
            Despesas_Pagas_Caixa_BRL: metrics.expensesPaidCash,
            Despesas_Competencia_BRL: metrics.competenceExpensesTotal,
            Saldo_Caixa_BRL: metrics.cashFlowBalance,
            Taxa_Poupanca_Percentual:
              metrics.savingsRatePercent != null
                ? `${metrics.savingsRatePercent.toFixed(2)}%`
                : '-',
            Patrimonio_Liquido_BRL: 0,
          },
        ];
  const wsEvolution = XLSX.utils.json_to_sheet(evolutionRows);
  XLSX.utils.book_append_sheet(wb, wsEvolution, 'Evolução mensal');

  const base64Content = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  return {
    workbook: wb,
    base64Content,
    sheetNames: wb.SheetNames,
    fileName: `financeiro-inteligente-${input.referenceYearMonth}.xlsx`,
  };
}
