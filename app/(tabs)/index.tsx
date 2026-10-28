import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  compareMonthlyPerformance,
  detectRecurringExpenses,
  evaluateCategoryBudgets,
} from '@/domain/finance/budget-and-comparison';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, sumCurrencyExact } from '@/utils/currency';

function getPreviousYearMonth(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = Number(parts[0] ?? 2026);
  const month = Number(parts[1] ?? 10);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const profile = useFinanceStore((s) => s.profile);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const filters = useFinanceStore((s) => s.filters);
  const setReferenceYearMonth = useFinanceStore((s) => s.setReferenceYearMonth);
  const setSelectedAccountFilter = useFinanceStore((s) => s.setSelectedAccountFilter);
  const setSelectedCategoryFilter = useFinanceStore((s) => s.setSelectedCategoryFilter);

  const previousYearMonth = useMemo(
    () => getPreviousYearMonth(filters.referenceYearMonth),
    [filters.referenceYearMonth],
  );

  const scopedTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (
        filters.selectedAccountId &&
        tx.account_id !== filters.selectedAccountId &&
        tx.destination_account_id !== filters.selectedAccountId
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, filters.selectedAccountId]);

  const comparison = useMemo(
    () =>
      compareMonthlyPerformance(
        categories,
        scopedTransactions,
        filters.referenceYearMonth,
        previousYearMonth,
      ),
    [categories, scopedTransactions, filters.referenceYearMonth, previousYearMonth],
  );

  const categoryBudgets = useMemo(
    () =>
      evaluateCategoryBudgets(
        categories,
        scopedTransactions,
        filters.referenceYearMonth,
      ),
    [categories, scopedTransactions, filters.referenceYearMonth],
  );

  const recurringGroups = useMemo(
    () => detectRecurringExpenses(scopedTransactions),
    [scopedTransactions],
  );

  const netWorthTotal = useMemo(
    () =>
      sumCurrencyExact(
        accounts
          .filter((a) => !a.is_archived && a.include_in_net_worth)
          .map((a) => a.current_balance),
      ),
    [accounts],
  );

  const availableMonths = ['2026-08', '2026-09', '2026-10', '2026-11'];

  const handleOpenCategoryTransactions = (categoryId: string) => {
    setSelectedCategoryFilter(categoryId);
    router.push('/(tabs)/transactions');
  };

  const metrics = comparison.currentMonth;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>
              Olá, {profile?.display_name ?? 'Investidor(a)'}
            </Text>
            <Text style={styles.subGreeting}>
              Visão mensal • Fluxo de Caixa, Competência e Patrimônio
            </Text>
          </View>
          <Pressable
            style={styles.exportBadge}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.exportBadgeText}>Exportar XLSX</Text>
          </Pressable>
        </View>

        {/* Filtro de Mês */}
        <View style={styles.filterRow}>
          {availableMonths.map((ym) => {
            const active = filters.referenceYearMonth === ym;
            return (
              <Pressable
                key={ym}
                style={[styles.monthChip, active && styles.monthChipActive]}
                onPress={() => setReferenceYearMonth(ym)}
              >
                <Text
                  style={[styles.monthChipText, active && styles.monthChipTextActive]}
                >
                  {ym}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filtro de Conta */}
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.accountChip,
              filters.selectedAccountId === null && styles.accountChipActive,
            ]}
            onPress={() => setSelectedAccountFilter(null)}
          >
            <Text style={styles.accountChipText}>Todas as Contas</Text>
          </Pressable>
          {accounts.map((acc) => {
            const active = filters.selectedAccountId === acc.id;
            return (
              <Pressable
                key={acc.id}
                style={[styles.accountChip, active && styles.accountChipActive]}
                onPress={() => setSelectedAccountFilter(acc.id)}
              >
                <Text style={styles.accountChipText}>
                  {acc.name} ({formatCurrencyBRL(acc.current_balance)})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Indicadores Principais */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Receitas Recebidas (Caixa)</Text>
            <Text style={[styles.kpiValue, { color: '#34D399' }]}>
              {formatCurrencyBRL(metrics.incomeReceived)}
            </Text>
            <Text style={styles.kpiHint}>
              vs {previousYearMonth}:{' '}
              {comparison.incomeDelta >= 0 ? '+' : ''}
              {formatCurrencyBRL(comparison.incomeDelta)}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Despesas Pagas (Caixa)</Text>
            <Text style={[styles.kpiValue, { color: '#F87171' }]}>
              {formatCurrencyBRL(metrics.expensesPaidCash)}
            </Text>
            <Text style={styles.kpiHint}>
              Inclui R$ {metrics.invoicePaymentsTotal.toFixed(2)} de faturas quitadas
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Saldo de Caixa do Período</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: metrics.cashFlowBalance >= 0 ? '#38BDF8' : '#EF4444' },
              ]}
            >
              {formatCurrencyBRL(metrics.cashFlowBalance)}
            </Text>
            <Text style={styles.kpiHint}>
              Taxa de poupança:{' '}
              {metrics.savingsRatePercent != null
                ? `${metrics.savingsRatePercent.toFixed(1)}%`
                : 'Sem receita no mês'}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Patrimônio nas Contas</Text>
            <Text style={[styles.kpiValue, { color: '#A78BFA' }]}>
              {formatCurrencyBRL(netWorthTotal)}
            </Text>
            <Text style={styles.kpiHint}>
              Transferências internas ({formatCurrencyBRL(metrics.internalTransfersTotal)})
              neutras
            </Text>
          </View>
        </View>

        {/* Competência: Fixas vs Variáveis vs Cartão */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Regime de Competência ({filters.referenceYearMonth})
          </Text>
          <Text style={styles.sectionSubtitle}>
            Total de gastos realizados no mês:{' '}
            <Text style={{ color: '#F8FAFC', fontWeight: '700' }}>
              {formatCurrencyBRL(metrics.competenceExpensesTotal)}
            </Text>{' '}
            (compras no cartão contam na competência; o pagamento da fatura não duplica o
            gasto).
          </Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Despesas Fixas</Text>
              <Text style={styles.breakdownVal}>
                {formatCurrencyBRL(metrics.fixedExpensesTotal)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Despesas Variáveis</Text>
              <Text style={styles.breakdownVal}>
                {formatCurrencyBRL(metrics.variableExpensesTotal)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Compras no Cartão</Text>
              <Text style={styles.breakdownVal}>
                {formatCurrencyBRL(metrics.creditCardSpendTotal)}
              </Text>
            </View>
          </View>
        </View>

        {/* Gráfico Interativo de Gastos por Categoria (Toque para abrir lançamentos) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Gastos por Categoria e Orçamento (Toque para abrir lançamentos)
          </Text>
          {categoryBudgets.every((c) => c.spentCompetenceAmount === 0) ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>
                Nenhum gasto registrado em {filters.referenceYearMonth}
              </Text>
              <Text style={styles.emptyDesc}>
                Toque no botão &quot;+ Novo Lançamento&quot; abaixo para registrar sua
                primeira receita ou despesa e visualizar os gráficos.
              </Text>
            </View>
          ) : (
            categoryBudgets
              .filter((c) => c.spentCompetenceAmount > 0 || c.monthlyBudget != null)
              .slice(0, 10)
              .map((cat) => {
                const maxRef =
                  cat.monthlyBudget ??
                  Math.max(metrics.competenceExpensesTotal, cat.spentCompetenceAmount, 1);
                const barWidthPercent = Math.min(
                  100,
                  Math.round((cat.spentCompetenceAmount / maxRef) * 100),
                );
                const barColor =
                  cat.alertLevel === 'exceeded'
                    ? '#EF4444'
                    : cat.alertLevel === 'warning'
                      ? '#F59E0B'
                      : cat.colorHex;

                return (
                  <Pressable
                    key={cat.categoryId}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir lançamentos da categoria ${cat.categoryName}`}
                    style={styles.chartRow}
                    onPress={() => handleOpenCategoryTransactions(cat.categoryId)}
                  >
                    <View style={styles.chartRowHeader}>
                      <Text style={styles.chartCatName}>{cat.categoryName}</Text>
                      <Text style={styles.chartCatAmount}>
                        {formatCurrencyBRL(cat.spentCompetenceAmount)}
                        {cat.monthlyBudget != null
                          ? ` / ${formatCurrencyBRL(cat.monthlyBudget)}`
                          : ''}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${barWidthPercent}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    {cat.alertLevel === 'exceeded' ? (
                      <Text style={styles.alertExceeded}>
                        Orçamento ultrapassado ({cat.usagePercent}%)
                      </Text>
                    ) : cat.alertLevel === 'warning' ? (
                      <Text style={styles.alertWarning}>
                        Alerta de limite atingido ({cat.usagePercent}%)
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })
          )}
        </View>

        {/* Comparativo com o Mês Anterior: Principais Aumentos e Reduções */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Comparativo com Mês Anterior ({previousYearMonth} vs{' '}
            {filters.referenceYearMonth})
          </Text>
          {comparison.topIncreases.length === 0 &&
          comparison.topReductions.length === 0 ? (
            <Text style={styles.emptyDesc}>
              Sem histórico comparável suficiente entre {previousYearMonth} e{' '}
              {filters.referenceYearMonth}.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {comparison.topIncreases.map((inc) => (
                <View key={`inc-${inc.categoryId}`} style={styles.variationRow}>
                  <Text style={styles.variationName}>▲ {inc.categoryName}</Text>
                  <Text style={[styles.variationVal, { color: '#F87171' }]}>
                    +{formatCurrencyBRL(inc.absoluteDelta)}
                    {inc.percentDelta != null ? ` (+${inc.percentDelta}%)` : ''}
                  </Text>
                </View>
              ))}
              {comparison.topReductions.map((red) => (
                <View key={`red-${red.categoryId}`} style={styles.variationRow}>
                  <Text style={styles.variationName}>▼ {red.categoryName}</Text>
                  <Text style={[styles.variationVal, { color: '#34D399' }]}>
                    {formatCurrencyBRL(red.absoluteDelta)}
                    {red.percentDelta != null ? ` (${red.percentDelta}%)` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Despesas Recorrentes Identificadas */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Despesas Recorrentes Identificadas</Text>
          {recurringGroups.length === 0 ? (
            <Text style={styles.emptyDesc}>
              Nenhuma despesa recorrente detectada ainda. Marque lançamentos como
              recorrentes para acompanhá-los aqui.
            </Text>
          ) : (
            recurringGroups.slice(0, 5).map((rec) => (
              <View key={rec.normalizedDescription} style={styles.variationRow}>
                <Text style={styles.variationName}>
                  {rec.normalizedDescription} ({rec.occurrencesCount}x)
                </Text>
                <Text style={styles.variationVal}>
                  {formatCurrencyBRL(rec.latestAmount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Botão Flutuante de Ação para Novo Lançamento (Seção 15) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Novo lançamento de receita ou despesa"
        style={styles.fabButton}
        onPress={() => router.push('/transactions/new')}
      >
        <Text style={styles.fabText}>+ Novo Lançamento</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 18,
    paddingTop: 44,
    paddingBottom: 96,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  subGreeting: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  exportBadge: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exportBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  monthChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  monthChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  monthChipText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  monthChipTextActive: {
    color: '#052E16',
    fontWeight: '800',
  },
  accountChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountChipActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C4A6E',
  },
  accountChipText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  kpiHint: {
    color: '#64748B',
    fontSize: 11,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4,
  },
  breakdownVal: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  chartRow: {
    marginBottom: 14,
  },
  chartRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  chartCatName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  chartCatAmount: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  alertExceeded: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  alertWarning: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  variationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  variationName: {
    color: '#E2E8F0',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  variationVal: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 6,
  },
  fabText: {
    color: '#052E16',
    fontSize: 15,
    fontWeight: '800',
  },
});
