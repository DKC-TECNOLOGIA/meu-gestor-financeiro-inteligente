import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { Plus, ReceiptText, Search, Trash2, X } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { TransactionKindType } from '@/types/database.types';
import { formatCurrencyBRL, formatDateBR, sumCurrencyExact } from '@/utils/currency';
import {
  Amount,
  AppText,
  Button,
  Card,
  CategoryIcon,
  ChipGroup,
  colors,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  MonthSwitcher,
  Screen,
  spacing,
  TextField,
  TransactionKindIcon,
} from '@/ui';

export default function TransactionsScreen() {
  const router = useRouter();
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const filters = useFinanceStore((s) => s.filters);
  const setReferenceYearMonth = useFinanceStore((s) => s.setReferenceYearMonth);
  const setSelectedCategoryFilter = useFinanceStore((s) => s.setSelectedCategoryFilter);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const [kindFilter, setKindFilter] = useState<'all' | TransactionKindType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        if (!tx.competence_date.startsWith(filters.referenceYearMonth)) return false;
        if (filters.selectedCategoryId && tx.category_id !== filters.selectedCategoryId) {
          return false;
        }
        if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
        if (q) {
          const catName = tx.category_id
            ? (categoryById.get(tx.category_id)?.name.toLowerCase() ?? '')
            : '';
          if (!tx.description.toLowerCase().includes(q) && !catName.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.competence_date.localeCompare(a.competence_date));
  }, [
    transactions,
    filters.referenceYearMonth,
    filters.selectedCategoryId,
    kindFilter,
    searchQuery,
    categoryById,
  ]);

  const totals = useMemo(() => {
    const income = sumCurrencyExact(
      filteredList.filter((t) => t.kind === 'income').map((t) => t.amount),
    );
    const expense = sumCurrencyExact(
      filteredList.filter((t) => t.kind === 'expense').map((t) => t.amount),
    );
    return { income, expense, net: sumCurrencyExact([income, -expense]) };
  }, [filteredList]);

  const handleConfirmDelete = (txId: string, description: string) => {
    Alert.alert(
      'Excluir lançamento?',
      `Deseja remover "${description}"? O saldo do mês será recalculado automaticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => void deleteTransaction(txId),
        },
      ],
    );
  };

  const selectedCategoryName = filters.selectedCategoryId
    ? categoryById.get(filters.selectedCategoryId)?.name
    : null;

  return (
    <Screen
      header={{
        title: 'Lançamentos',
        right: (
          <Button
            label="Adicionar"
            icon={Plus}
            size="sm"
            onPress={() => router.push('/transactions/new')}
          />
        ),
      }}
    >
      {/* Seletor de mês + Resumo de entradas e saídas (inspirado na referência clean) */}
      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
          <MonthSwitcher
            value={filters.referenceYearMonth}
            onChange={setReferenceYearMonth}
          />
        </View>
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <AppText variant="caption" tone="secondary">
            Resultado dos lançamentos filtrados
          </AppText>
          <AppText
            variant="display"
            tone={totals.net >= 0 ? 'default' : 'negative'}
            style={{ marginTop: 2 }}
          >
            {totals.net < 0 ? '− ' : ''}
            {formatCurrencyBRL(Math.abs(totals.net))}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: spacing.md,
          }}
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="caption" tone="secondary">
              Entradas
            </AppText>
            <AppText
              variant="bodyStrong"
              tone="positive"
              style={{ fontVariant: ['tabular-nums'], marginTop: 2 }}
            >
              {formatCurrencyBRL(totals.income)}
            </AppText>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="caption" tone="secondary">
              Despesas
            </AppText>
            <AppText
              variant="bodyStrong"
              style={{ fontVariant: ['tabular-nums'], marginTop: 2 }}
            >
              − {formatCurrencyBRL(totals.expense)}
            </AppText>
          </View>
        </View>
      </Card>

      {/* Busca rápida */}
      <TextField
        icon={Search}
        placeholder="Buscar por descrição ou categoria…"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filtros por tipo */}
      <ChipGroup
        style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
        value={kindFilter}
        onChange={setKindFilter}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
          { value: 'invoice_payment', label: 'Faturas' },
          { value: 'transfer', label: 'Transferências' },
        ]}
      />

      {selectedCategoryName ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedCategoryFilter(null)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.brandSoft,
            borderRadius: 10,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          <AppText variant="label" tone="brand" style={{ fontWeight: '600' }}>
            Categoria: {selectedCategoryName}
          </AppText>
          <X color={colors.brand} size={16} />
        </Pressable>
      ) : null}

      {/* Lista de lançamentos */}
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {filteredList.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Nenhum lançamento encontrado"
            description="Adicione uma receita, despesa ou escaneie uma nota fiscal para começar."
            actionLabel="Novo lançamento"
            onAction={() => router.push('/transactions/new')}
          />
        ) : (
          filteredList.map((tx, idx) => {
            const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
            const subtitleParts = [
              cat?.name ??
                (tx.kind === 'transfer' ? 'Transferência' : 'Pagamento de fatura'),
              formatDateBR(tx.competence_date),
              tx.payment_method.toUpperCase(),
            ];
            if (tx.is_fixed) subtitleParts.push('Fixa');
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
                  subtitle={subtitleParts.join(' · ')}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Amount
                        value={tx.amount}
                        kind={
                          tx.kind === 'income'
                            ? 'income'
                            : tx.kind === 'transfer'
                              ? 'neutral'
                              : 'expense'
                        }
                      />
                      <IconButton
                        icon={Trash2}
                        size={32}
                        variant="ghost"
                        accessibilityLabel={`Excluir ${tx.description}`}
                        onPress={() => handleConfirmDelete(tx.id, tx.description)}
                      />
                    </View>
                  }
                />
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
