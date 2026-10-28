import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { TransactionKindType } from '@/types/database.types';
import { formatCurrencyBRL, formatDateBR } from '@/utils/currency';

export default function TransactionsScreen() {
  const router = useRouter();
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const filters = useFinanceStore((s) => s.filters);
  const setSelectedCategoryFilter = useFinanceStore((s) => s.setSelectedCategoryFilter);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);

  const [kindFilter, setKindFilter] = useState<'all' | TransactionKindType>('all');

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx.competence_date.startsWith(filters.referenceYearMonth)) {
        return false;
      }
      if (filters.selectedCategoryId && tx.category_id !== filters.selectedCategoryId) {
        return false;
      }
      if (kindFilter !== 'all' && tx.kind !== kindFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, filters.referenceYearMonth, filters.selectedCategoryId, kindFilter]);

  const handleConfirmDelete = (txId: string, description: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o lançamento "${description}"? Esta operação removerá o item do cálculo mensal.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteTransaction(txId);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Receitas e Despesas</Text>
            <Text style={styles.subtitle}>
              Competência: {filters.referenceYearMonth} • {filteredList.length}{' '}
              lançamento(s)
            </Text>
          </View>
          <Pressable
            style={styles.newButton}
            onPress={() => router.push('/transactions/new')}
          >
            <Text style={styles.newButtonText}>+ Adicionar</Text>
          </Pressable>
        </View>

        {/* Filtros de Tipo */}
        <View style={styles.chipsRow}>
          {(
            [
              { value: 'all', label: 'Todos' },
              { value: 'income', label: 'Receitas' },
              { value: 'expense', label: 'Despesas' },
              { value: 'invoice_payment', label: 'Pagto. Fatura' },
              { value: 'transfer', label: 'Transferências' },
            ] as const
          ).map((item) => {
            const active = kindFilter === item.value;
            return (
              <Pressable
                key={item.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setKindFilter(item.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filters.selectedCategoryId ? (
          <Pressable
            style={styles.activeCategoryBanner}
            onPress={() => setSelectedCategoryFilter(null)}
          >
            <Text style={styles.activeCategoryText}>
              Filtrado por categoria:{' '}
              {categoryNameMap.get(filters.selectedCategoryId) ?? 'Selecionada'} (Toque
              para limpar)
            </Text>
          </Pressable>
        ) : null}

        {filteredList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum lançamento encontrado</Text>
            <Text style={styles.emptyDesc}>
              Registre receitas, despesas, compras no cartão ou transferências para
              acompanhar a evolução do seu orçamento em {filters.referenceYearMonth}.
            </Text>
            <Pressable
              style={styles.emptyCta}
              onPress={() => router.push('/transactions/new')}
            >
              <Text style={styles.emptyCtaText}>Criar Primeiro Lançamento</Text>
            </Pressable>
          </View>
        ) : (
          filteredList.map((tx) => {
            const isIncome = tx.kind === 'income';
            const isTransfer = tx.kind === 'transfer';
            const amountColor = isIncome
              ? '#34D399'
              : isTransfer
                ? '#38BDF8'
                : '#F87171';

            return (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txMainRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDescription}>{tx.description}</Text>
                    <Text style={styles.txMeta}>
                      {tx.category_id
                        ? (categoryNameMap.get(tx.category_id) ?? 'Categoria')
                        : tx.kind === 'transfer'
                          ? 'Transferência entre contas'
                          : 'Pagamento de fatura'}{' '}
                      • Competência: {formatDateBR(tx.competence_date)}
                    </Text>
                    <Text style={styles.txBadges}>
                      Forma: {tx.payment_method.toUpperCase()} • Status: {tx.status} •
                      Origem: {tx.origin}
                      {tx.is_fixed ? ' • Fixa' : ''}
                      {tx.is_recurring ? ' • Recorrente' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: amountColor }]}>
                    {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}
                    {formatCurrencyBRL(tx.amount)}
                  </Text>
                </View>

                <View style={styles.txActionsRow}>
                  <Pressable
                    style={styles.editBtn}
                    onPress={() => router.push(`/transactions/${tx.id}`)}
                  >
                    <Text style={styles.editBtnText}>Editar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleConfirmDelete(tx.id, tx.description)}
                  >
                    <Text style={styles.deleteBtnText}>Excluir</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  newButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newButtonText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 13,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#052E16',
    fontWeight: '800',
  },
  activeCategoryBanner: {
    backgroundColor: '#0C4A6E',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  activeCategoryText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyCta: {
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyCtaText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 14,
  },
  txCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  txMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  txDescription: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  txMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 4,
  },
  txBadges: {
    color: '#64748B',
    fontSize: 11,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  txActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  editBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#450A0A',
  },
  deleteBtnText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
});
