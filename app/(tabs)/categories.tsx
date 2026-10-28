import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { evaluateCategoryBudgets } from '@/domain/finance/budget-and-comparison';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { CategoryKindType } from '@/types/database.types';
import { formatCurrencyBRL } from '@/utils/currency';

export default function CategoriesAndBudgetsScreen() {
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const filters = useFinanceStore((s) => s.filters);
  const createCustomCategory = useFinanceStore((s) => s.createCustomCategory);
  const updateCategoryBudget = useFinanceStore((s) => s.updateCategoryBudget);

  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKindType>('expense');
  const [newBudgetText, setNewBudgetText] = useState('');
  const [editingBudgetMap, setEditingBudgetMap] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const budgetStatuses = useMemo(
    () =>
      evaluateCategoryBudgets(
        categories,
        transactions,
        filters.referenceYearMonth,
      ),
    [categories, transactions, filters.referenceYearMonth],
  );

  const handleCreateCustomCategory = async () => {
    setFeedbackMessage(null);
    const parsedBudget = newBudgetText.trim()
      ? Number(newBudgetText.replace(',', '.'))
      : null;

    try {
      await createCustomCategory({
        name: newName,
        kind: newKind,
        icon: 'folder',
        colorHex: '#10B981',
        monthlyBudget:
          parsedBudget != null && Number.isFinite(parsedBudget) ? parsedBudget : null,
        alertThresholdPercent: 80,
        isFixedExpenseDefault: false,
        isEssential: false,
      });
      setNewName('');
      setNewBudgetText('');
      setFeedbackMessage('Categoria personalizada criada com sucesso!');
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? err.message : 'Erro ao criar categoria.',
      );
    }
  };

  const handleSaveBudget = async (categoryId: string) => {
    setFeedbackMessage(null);
    const rawVal = editingBudgetMap[categoryId] ?? '';
    const parsed = rawVal.trim() ? Number(rawVal.replace(',', '.')) : null;
    try {
      await updateCategoryBudget(
        categoryId,
        parsed != null && Number.isFinite(parsed) ? parsed : null,
        80,
      );
      setFeedbackMessage('Orçamento atualizado!');
    } catch (err) {
      setFeedbackMessage(
        err instanceof Error ? err.message : 'Erro ao atualizar orçamento.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Categorias e Orçamentos Mensais</Text>
      <Text style={styles.subtitle}>
        Configure tetos de gastos por categoria e receba alertas automáticos ao atingir
        80% ou 100% do limite em {filters.referenceYearMonth}.
      </Text>

      {feedbackMessage ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      ) : null}

      {/* Criar Categoria Personalizada */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Nova Categoria Personalizada</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome da categoria (ex.: Pet Shop, Farmácia)"
          placeholderTextColor="#64748B"
          value={newName}
          onChangeText={setNewName}
        />
        <View style={styles.chipsRow}>
          {(
            [
              { value: 'expense', label: 'Despesa' },
              { value: 'income', label: 'Receita' },
            ] as const
          ).map((k) => {
            const active = newKind === k.value;
            return (
              <Pressable
                key={k.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setNewKind(k.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {newKind === 'expense' ? (
          <TextInput
            style={styles.input}
            placeholder="Orçamento mensal opcional (R$)"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            value={newBudgetText}
            onChangeText={setNewBudgetText}
          />
        ) : null}

        <Pressable
          style={styles.primaryBtn}
          onPress={() => void handleCreateCustomCategory()}
        >
          <Text style={styles.primaryBtnText}>Adicionar Categoria</Text>
        </Pressable>
      </View>

      {/* Lista de Categorias de Despesa e Orçamentos */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          Limites de Despesas ({budgetStatuses.length} categorias)
        </Text>
        {budgetStatuses.map((b) => {
          const currentInputVal =
            editingBudgetMap[b.categoryId] ??
            (b.monthlyBudget != null ? String(b.monthlyBudget) : '');

          return (
            <View key={b.categoryId} style={styles.catItem}>
              <View style={styles.catHeader}>
                <Text style={styles.catName}>{b.categoryName}</Text>
                <Text style={styles.catSpent}>
                  Gasto: {formatCurrencyBRL(b.spentCompetenceAmount)}
                </Text>
              </View>

              <View style={styles.budgetEditRow}>
                <TextInput
                  style={styles.budgetInput}
                  placeholder="Definir teto R$"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={currentInputVal}
                  onChangeText={(txt) =>
                    setEditingBudgetMap((prev) => ({ ...prev, [b.categoryId]: txt }))
                  }
                />
                <Pressable
                  style={styles.saveBudgetBtn}
                  onPress={() => void handleSaveBudget(b.categoryId)}
                >
                  <Text style={styles.saveBudgetBtnText}>Salvar Teto</Text>
                </Pressable>
              </View>

              {b.monthlyBudget != null ? (
                <Text style={styles.budgetStatusText}>
                  Uso: {b.usagePercent ?? 0}% • Restante:{' '}
                  {formatCurrencyBRL(b.remainingBudgetAmount ?? 0)} ({b.alertLevel})
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    padding: 18,
    paddingTop: 44,
    paddingBottom: 60,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  feedbackBox: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  feedbackText: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 14,
  },
  catItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  catSpent: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  budgetEditRow: {
    flexDirection: 'row',
    gap: 8,
  },
  budgetInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  saveBudgetBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 8,
  },
  saveBudgetBtnText: {
    color: '#082F49',
    fontWeight: '800',
    fontSize: 12,
  },
  budgetStatusText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 6,
  },
});
