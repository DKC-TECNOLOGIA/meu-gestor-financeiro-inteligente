import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  FileDown,
  Plus,
  ReceiptText,
  Target,
  WalletCards,
} from 'lucide-react-native';
import {
  compareMonthlyPerformance,
  detectRecurringExpenses,
  evaluateCategoryBudgets,
} from '@/domain/finance/budget-and-comparison';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, formatDateBR, sumCurrencyExact } from '@/utils/currency';
import {
  Amount,
  AppText,
  Badge,
  BrandMark,
  Button,
  Card,
  CategoryIcon,
  ChipGroup,
  colors,
  Divider,
  EmptyState,
  formatYearMonthLabel,
  IconButton,
  InlineMessage,
  ListRow,
  MonthSwitcher,
  ProgressBar,
  QuickAction,
  radius,
  Screen,
  Section,
  SectionHeader,
  spacing,
  Sparkline,
  TransactionKindIcon,
  budgetTone,
} from '@/ui';

function getPreviousYearMonth(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const year = Number(parts[0] ?? 2026);
  const month = Number(parts[1] ?? 10);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

function formatDelta(value: number, percent: number | null): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const pct = percent != null ? ` (${sign}${Math.abs(percent).toFixed(0)}%)` : '';
  return `${sign}${formatCurrencyBRL(Math.abs(value))}${pct}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const profile = useFinanceStore((s) => s.profile);
  const avatarUri = useFinanceStore((s) => s.avatarUri);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const cardInvoices = useFinanceStore((s) => s.cardInvoices);
  const financialGoals = useFinanceStore((s) => s.financialGoals);
  const filters = useFinanceStore((s) => s.filters);
  const isLoading = useFinanceStore((s) => s.isLoading);
  const errorMessage = useFinanceStore((s) => s.errorMessage);
  const clearError = useFinanceStore((s) => s.clearError);
  const setReferenceYearMonth = useFinanceStore((s) => s.setReferenceYearMonth);
  const setSelectedAccountFilter = useFinanceStore((s) => s.setSelectedAccountFilter);
  const setSelectedCategoryFilter = useFinanceStore((s) => s.setSelectedCategoryFilter);

  const [heroWidth, setHeroWidth] = useState(0);

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
      evaluateCategoryBudgets(categories, scopedTransactions, filters.referenceYearMonth),
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

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cardById = useMemo(() => new Map(creditCards.map((c) => [c.id, c])), [creditCards]);

  const monthTransactions = useMemo(
    () =>
      scopedTransactions.filter((tx) =>
        tx.competence_date.startsWith(filters.referenceYearMonth),
      ),
    [scopedTransactions, filters.referenceYearMonth],
  );

  /**
   * Evolução diária do resultado de caixa no mês (entradas − saídas efetivas),
   * calculada a partir dos lançamentos reais. Compras no cartão entram no caixa
   * apenas quando a fatura é paga, e transferências internas são neutras.
   */
  const cashTrend = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const tx of monthTransactions) {
      const day = Number((tx.settlement_date ?? tx.competence_date).slice(8, 10));
      let delta = 0;
      if (tx.kind === 'income') delta = tx.amount;
      else if (tx.kind === 'invoice_payment') delta = -tx.amount;
      else if (tx.kind === 'expense' && tx.payment_method !== 'credit_card') delta = -tx.amount;
      if (delta !== 0 && Number.isFinite(day)) byDay.set(day, (byDay.get(day) ?? 0) + delta);
    }
    if (byDay.size < 2) return [];
    const lastDay = Math.max(...byDay.keys());
    const series: number[] = [];
    let running = 0;
    for (let d = 1; d <= lastDay; d += 1) {
      running += byDay.get(d) ?? 0;
      series.push(running);
    }
    return series;
  }, [monthTransactions]);

  const budgetSummary = useMemo(() => {
    const budgeted = categoryBudgets.filter((c) => c.monthlyBudget != null);
    const total = sumCurrencyExact(budgeted.map((c) => c.monthlyBudget ?? 0));
    const spent = sumCurrencyExact(budgeted.map((c) => c.spentCompetenceAmount));
    return {
      hasBudgets: budgeted.length > 0,
      total,
      spent,
      remaining: sumCurrencyExact([total, -spent]),
      alerts: budgeted.filter((c) => c.alertLevel === 'warning' || c.alertLevel === 'exceeded')
        .length,
    };
  }, [categoryBudgets]);

  const topCategories = useMemo(
    () =>
      categoryBudgets
        .filter((c) => c.spentCompetenceAmount > 0)
        .sort((a, b) => b.spentCompetenceAmount - a.spentCompetenceAmount)
        .slice(0, 4),
    [categoryBudgets],
  );

  const upcomingInvoices = useMemo(
    () =>
      cardInvoices
        .filter((inv) => inv.status !== 'paid' && inv.total_amount - inv.paid_amount > 0)
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 3),
    [cardInvoices],
  );

  const activeGoals = useMemo(
    () =>
      financialGoals
        .filter((g) => g.status === 'active')
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 2),
    [financialGoals],
  );

  const recentTransactions = useMemo(
    () =>
      [...monthTransactions]
        .sort(
          (a, b) =>
            b.competence_date.localeCompare(a.competence_date) ||
            b.created_at.localeCompare(a.created_at),
        )
        .slice(0, 5),
    [monthTransactions],
  );

  const handleOpenCategoryTransactions = (categoryId: string) => {
    setSelectedCategoryFilter(categoryId);
    router.push('/(tabs)/transactions');
  };

  const metrics = comparison.currentMonth;
  const firstName = (profile?.display_name ?? '').trim().split(/\s+/)[0] || 'você';
  const monthResultPositive = metrics.cashFlowBalance >= 0;

  return (
    <Screen>
      {/* Cabeçalho */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
          onPress={() => router.push('/(tabs)/profile')}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                borderWidth: 1.5,
                borderColor: colors.brand,
              }}
            />
          ) : (
            <BrandMark size={34} />
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="secondary">
            Olá, {firstName}
          </AppText>
          <AppText variant="heading" accessibilityRole="header">
            Sua visão do mês
          </AppText>
        </View>
        <IconButton
          icon={FileDown}
          accessibilityLabel="Exportar relatório em Excel"
          onPress={() => router.push('/export')}
        />
      </View>

      {errorMessage ? (
        <InlineMessage
          tone="danger"
          message={errorMessage}
          style={{ marginBottom: spacing.lg }}
          action={
            <Pressable onPress={clearError} accessibilityRole="button" hitSlop={8}>
              <AppText variant="label" tone="negative" style={{ fontWeight: '600', marginTop: 4 }}>
                Dispensar
              </AppText>
            </Pressable>
          }
        />
      ) : null}

      {accounts.length > 1 ? (
        <ChipGroup
          style={{ marginBottom: spacing.lg }}
          value={filters.selectedAccountId ?? '__all__'}
          onChange={(v) => setSelectedAccountFilter(v === '__all__' ? null : v)}
          options={[
            { value: '__all__', label: 'Todas as contas' },
            ...accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      ) : null}

      {/* Hero: saldo + resultado do mês */}
      <View
        onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}
        style={{
          backgroundColor: colors.brandDeep,
          borderRadius: radius.xl,
          padding: spacing.xl,
          paddingBottom: spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginHorizontal: -spacing.sm,
          }}
        >
          <MonthSwitcher
            value={filters.referenceYearMonth}
            onChange={setReferenceYearMonth}
            onDeep
          />
        </View>

        <AppText variant="label" tone="onDeepMuted" style={{ marginTop: spacing.lg }}>
          Saldo nas contas
        </AppText>
        <AppText
          variant="display"
          tone="onDeep"
          adjustsFontSizeToFit
          numberOfLines={1}
          accessibilityLabel={`Saldo nas contas: ${formatCurrencyBRL(netWorthTotal)}`}
        >
          {formatCurrencyBRL(netWorthTotal)}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.sm,
              backgroundColor: monthResultPositive ? 'rgba(74, 222, 128, 0.16)' : 'rgba(248, 113, 113, 0.18)',
            }}
          >
            <AppText
              variant="caption"
              style={{
                color: monthResultPositive ? colors.accentOnDeep : '#FCA5A5',
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
              }}
            >
              {monthResultPositive ? '+' : '−'} {formatCurrencyBRL(Math.abs(metrics.cashFlowBalance))}
            </AppText>
          </View>
          <AppText variant="caption" tone="onDeepMuted">
            resultado em {formatYearMonthLabel(filters.referenceYearMonth).split(' de ')[0]?.toLowerCase()}
            {metrics.savingsRatePercent != null
              ? ` · poupou ${metrics.savingsRatePercent.toFixed(0)}%`
              : ''}
          </AppText>
        </View>

        {cashTrend.length >= 2 && heroWidth > 0 ? (
          <View style={{ marginTop: spacing.lg, marginHorizontal: -spacing.xs }}>
            <Sparkline values={cashTrend} width={heroWidth - spacing.xl * 2 + spacing.sm} height={52} />
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.lg,
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.brandDeepRaised,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ArrowDownLeft color={colors.accentOnDeep} size={14} />
              <AppText variant="caption" tone="onDeepMuted">
                Entradas
              </AppText>
            </View>
            <AppText variant="amountLarge" tone="onDeep" numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrencyBRL(metrics.incomeReceived)}
            </AppText>
          </View>
          <View style={{ width: 1, backgroundColor: colors.brandDeepRaised, marginHorizontal: spacing.lg }} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ArrowUpRight color="#FCA5A5" size={14} />
              <AppText variant="caption" tone="onDeepMuted">
                Saídas
              </AppText>
            </View>
            <AppText variant="amountLarge" tone="onDeep" numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrencyBRL(metrics.expensesPaidCash)}
            </AppText>
          </View>
        </View>
      </View>

      {/* Ações rápidas */}
      <View style={{ flexDirection: 'row', marginTop: spacing.xl }}>
        <QuickAction
          icon={ArrowUpRight}
          label="Despesa"
          onPress={() => router.push('/transactions/new?kind=expense')}
        />
        <QuickAction
          icon={ArrowDownLeft}
          label="Receita"
          onPress={() => router.push('/transactions/new?kind=income')}
        />
        <QuickAction
          icon={ArrowLeftRight}
          label="Transferir"
          onPress={() => router.push('/transactions/new?kind=transfer')}
        />
        <QuickAction
          icon={ReceiptText}
          label="Ler nota"
          onPress={() => router.push('/(tabs)/scanner')}
        />
      </View>

      {/* Orçamento do mês */}
      <Section>
        <SectionHeader
          title="Orçamento do mês"
          actionLabel="Ver tudo"
          onAction={() => router.push('/(tabs)/categories')}
        />
        <Card>
          {budgetSummary.hasBudgets ? (
            <>
              <AppText variant="label" tone="secondary">
                {budgetSummary.remaining >= 0 ? 'Você ainda pode gastar' : 'Acima do orçamento em'}
              </AppText>
              <AppText
                variant="title"
                tone={budgetSummary.remaining >= 0 ? 'default' : 'negative'}
                style={{ fontVariant: ['tabular-nums'], marginTop: 2 }}
              >
                {formatCurrencyBRL(Math.abs(budgetSummary.remaining))}
              </AppText>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar
                  value={budgetSummary.total > 0 ? budgetSummary.spent / budgetSummary.total : 0}
                  tone={
                    budgetSummary.remaining < 0
                      ? 'negative'
                      : budgetSummary.total > 0 && budgetSummary.spent / budgetSummary.total >= 0.8
                        ? 'warning'
                        : 'brand'
                  }
                  height={8}
                  accessibilityLabel="Uso do orçamento mensal"
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <AppText variant="caption" tone="secondary">
                  {formatCurrencyBRL(budgetSummary.spent)} gastos
                </AppText>
                <AppText variant="caption" tone="secondary">
                  de {formatCurrencyBRL(budgetSummary.total)}
                </AppText>
              </View>
              {budgetSummary.alerts > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  <Badge
                    tone="warning"
                    label={
                      budgetSummary.alerts === 1
                        ? '1 categoria perto ou acima do limite'
                        : `${budgetSummary.alerts} categorias perto ou acima do limite`
                    }
                  />
                </View>
              ) : null}
            </>
          ) : (
            <View style={{ gap: spacing.md }}>
              <AppText variant="label" tone="secondary">
                Defina limites por categoria para saber quanto ainda pode gastar neste mês.
              </AppText>
              <Button
                label="Definir orçamentos"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/(tabs)/categories')}
                style={{ alignSelf: 'flex-start' }}
              />
            </View>
          )}

          {topCategories.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <Divider />
              {topCategories.map((cat) => {
                const ratio =
                  cat.monthlyBudget != null && cat.monthlyBudget > 0
                    ? cat.spentCompetenceAmount / cat.monthlyBudget
                    : metrics.competenceExpensesTotal > 0
                      ? cat.spentCompetenceAmount / metrics.competenceExpensesTotal
                      : 0;
                return (
                  <Pressable
                    key={cat.categoryId}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir lançamentos da categoria ${cat.categoryName}`}
                    onPress={() => handleOpenCategoryTransactions(cat.categoryId)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingTop: spacing.md,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <CategoryIcon icon={cat.icon} colorHex={cat.colorHex} size={36} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                        <AppText variant="label" numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>
                          {cat.categoryName}
                        </AppText>
                        <AppText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                          {formatCurrencyBRL(cat.spentCompetenceAmount)}
                        </AppText>
                      </View>
                      <ProgressBar value={ratio} tone={budgetTone(cat.alertLevel)} height={4} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Card>
      </Section>

      {/* Próximos vencimentos (faturas de cartão em aberto) */}
      {upcomingInvoices.length > 0 ? (
        <Section>
          <SectionHeader
            title="Próximos vencimentos"
            actionLabel="Cartões"
            onAction={() => router.push('/cards')}
          />
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {upcomingInvoices.map((inv, idx) => {
              const card = cardById.get(inv.credit_card_id);
              const overdue = inv.status === 'overdue';
              return (
                <View key={inv.id}>
                  {idx > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    onPress={() => router.push('/cards')}
                    leading={
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: overdue ? colors.negativeSoft : colors.surfaceMuted,
                        }}
                      >
                        {overdue ? (
                          <CalendarClock color={colors.negative} size={18} />
                        ) : (
                          <WalletCards color={colors.textSecondary} size={18} />
                        )}
                      </View>
                    }
                    title={`Fatura ${card?.name ?? 'do cartão'}`}
                    subtitle={overdue ? `Venceu em ${formatDateBR(inv.due_date)}` : `Vence em ${formatDateBR(inv.due_date)}`}
                    trailing={
                      <Amount
                        value={inv.total_amount - inv.paid_amount}
                        tone={overdue ? 'negative' : 'default'}
                      />
                    }
                  />
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}

      {/* Metas */}
      <Section>
        <SectionHeader
          title="Metas"
          actionLabel={activeGoals.length > 0 ? 'Ver todas' : undefined}
          onAction={() => router.push('/goals')}
        />
        {activeGoals.length === 0 ? (
          <Card onPress={() => router.push('/goals')} accessibilityLabel="Criar uma meta financeira">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Target color={colors.brand} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Crie sua primeira meta</AppText>
                <AppText variant="caption" tone="secondary">
                  Reserva de emergência, viagem, quitar uma dívida…
                </AppText>
              </View>
              <Plus color={colors.brand} size={20} />
            </View>
          </Card>
        ) : (
          <Card style={{ gap: spacing.lg }}>
            {activeGoals.map((goal) => {
              const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
              return (
                <Pressable
                  key={goal.id}
                  accessibilityRole="button"
                  onPress={() => router.push('/goals')}
                  style={({ pressed }) => ({ gap: spacing.sm, opacity: pressed ? 0.6 : 1 })}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                      {goal.name}
                    </AppText>
                    <AppText variant="label" tone="brand" style={{ fontWeight: '600' }}>
                      {Math.min(100, Math.round(ratio * 100))}%
                    </AppText>
                  </View>
                  <ProgressBar value={ratio} tone="accent" height={6} />
                  <AppText variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCurrencyBRL(goal.current_amount)} de {formatCurrencyBRL(goal.target_amount)}
                  </AppText>
                </Pressable>
              );
            })}
          </Card>
        )}
      </Section>

      {/* Movimentações recentes */}
      <Section>
        <SectionHeader
          title="Movimentações recentes"
          actionLabel={recentTransactions.length > 0 ? 'Ver todas' : undefined}
          onAction={() => router.push('/(tabs)/transactions')}
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {recentTransactions.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title={isLoading ? 'Carregando lançamentos…' : 'Nenhum lançamento neste mês'}
              description="Registre uma receita ou despesa para acompanhar seu mês por aqui."
              actionLabel={isLoading ? undefined : 'Adicionar lançamento'}
              onAction={() => router.push('/transactions/new')}
            />
          ) : (
            recentTransactions.map((tx, idx) => {
              const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
              return (
                <View key={tx.id}>
                  {idx > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    onPress={() => router.push(`/transactions/${tx.id}`)}
                    leading={
                      cat ? (
                        <CategoryIcon icon={cat.icon} colorHex={cat.color_hex} />
                      ) : (
                        <TransactionKindIcon kind={tx.kind} />
                      )
                    }
                    title={tx.description}
                    subtitle={`${cat?.name ?? (tx.kind === 'transfer' ? 'Transferência' : 'Pagamento de fatura')} · ${formatDateBR(tx.competence_date).slice(0, 5)}`}
                    trailing={
                      <Amount
                        value={tx.amount}
                        kind={tx.kind === 'income' ? 'income' : tx.kind === 'transfer' ? 'neutral' : 'expense'}
                      />
                    }
                  />
                </View>
              );
            })
          )}
        </Card>
      </Section>

      {/* Comparação com o mês anterior */}
      <Section>
        <SectionHeader
          title={`Comparado a ${formatYearMonthLabel(previousYearMonth).split(' de ')[0]?.toLowerCase()}`}
          description="Gastos pelo regime de competência: compras no cartão contam no mês da compra."
        />
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" tone="secondary">
                Receitas
              </AppText>
              <AppText
                variant="label"
                tone={comparison.incomeDelta >= 0 ? 'positive' : 'negative'}
                style={{ fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 2 }}
              >
                {formatDelta(comparison.incomeDelta, comparison.incomeDeltaPercent)}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" tone="secondary">
                Gastos do mês
              </AppText>
              <AppText
                variant="label"
                tone={comparison.competenceExpensesDelta <= 0 ? 'positive' : 'negative'}
                style={{ fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 2 }}
              >
                {formatDelta(
                  comparison.competenceExpensesDelta,
                  comparison.competenceExpensesDeltaPercent,
                )}
              </AppText>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {[
              { label: 'Fixas', value: metrics.fixedExpensesTotal },
              { label: 'Variáveis', value: metrics.variableExpensesTotal },
              { label: 'No cartão', value: metrics.creditCardSpendTotal },
            ].map((item) => (
              <View key={item.label} style={{ flex: 1 }}>
                <AppText variant="caption" tone="secondary">
                  {item.label}
                </AppText>
                <AppText variant="label" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {formatCurrencyBRL(item.value)}
                </AppText>
              </View>
            ))}
          </View>

          {comparison.topIncreases.length > 0 || comparison.topReductions.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              {comparison.topIncreases.map((inc) => (
                <View
                  key={`inc-${inc.categoryId}`}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <ArrowUpRight color={colors.negative} size={14} />
                    <AppText variant="label" numberOfLines={1}>
                      {inc.categoryName}
                    </AppText>
                  </View>
                  <AppText variant="label" tone="negative" style={{ fontVariant: ['tabular-nums'] }}>
                    +{formatCurrencyBRL(inc.absoluteDelta)}
                    {inc.percentDelta != null ? ` (+${inc.percentDelta}%)` : ''}
                  </AppText>
                </View>
              ))}
              {comparison.topReductions.map((red) => (
                <View
                  key={`red-${red.categoryId}`}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <ArrowDownLeft color={colors.positive} size={14} />
                    <AppText variant="label" numberOfLines={1}>
                      {red.categoryName}
                    </AppText>
                  </View>
                  <AppText variant="label" tone="positive" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCurrencyBRL(red.absoluteDelta)}
                    {red.percentDelta != null ? ` (${red.percentDelta}%)` : ''}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="caption" tone="tertiary" style={{ marginTop: spacing.md }}>
              Ainda não há histórico suficiente para comparar categorias entre os dois meses.
            </AppText>
          )}
        </Card>
      </Section>

      {/* Despesas recorrentes */}
      {recurringGroups.length > 0 ? (
        <Section>
          <SectionHeader
            title="Despesas recorrentes"
            description="Identificadas a partir dos seus lançamentos."
          />
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {recurringGroups.slice(0, 5).map((rec, idx) => (
              <View key={rec.normalizedDescription}>
                {idx > 0 ? <Divider /> : null}
                <ListRow
                  title={rec.normalizedDescription.charAt(0).toUpperCase() + rec.normalizedDescription.slice(1)}
                  subtitle={`${rec.occurrencesCount} ocorrências`}
                  trailing={<Amount value={rec.latestAmount} />}
                />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
