import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { evaluateCategoryBudgets } from '@/domain/finance/budget-and-comparison';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { CategoryKindType } from '@/types/database.types';
import { formatCurrencyBRL } from '@/utils/currency';
import {
  AppText,
  Badge,
  Button,
  Card,
  CategoryIcon,
  InlineMessage,
  MonthSwitcher,
  ProgressBar,
  Screen,
  Section,
  SectionHeader,
  SegmentedControl,
  spacing,
  TextField,
  budgetTone,
} from '@/ui';

export default function CategoriesAndBudgetsScreen() {
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const filters = useFinanceStore((s) => s.filters);
  const setReferenceYearMonth = useFinanceStore((s) => s.setReferenceYearMonth);
  const createCustomCategory = useFinanceStore((s) => s.createCustomCategory);
  const updateCategoryBudget = useFinanceStore((s) => s.updateCategoryBudget);

  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKindType>('expense');
  const [newBudgetText, setNewBudgetText] = useState('');
  const [editingBudgetMap, setEditingBudgetMap] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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
    setIsError(false);
    const parsedBudget = newBudgetText.trim()
      ? Number(newBudgetText.replace(',', '.'))
      : null;

    try {
      await createCustomCategory({
        name: newName,
        kind: newKind,
        icon: 'shopping-bag',
        colorHex: '#166534',
        monthlyBudget:
          parsedBudget != null && Number.isFinite(parsedBudget) ? parsedBudget : null,
        alertThresholdPercent: 80,
        isFixedExpenseDefault: false,
        isEssential: false,
      });
      setNewName('');
      setNewBudgetText('');
      setFeedbackMessage('Categoria personalizada criada com sucesso.');
    } catch (err) {
      setIsError(true);
      setFeedbackMessage(
        err instanceof Error ? err.message : 'Erro ao criar categoria.',
      );
    }
  };

  const handleSaveBudget = async (categoryId: string) => {
    setFeedbackMessage(null);
    setIsError(false);
    const rawVal = editingBudgetMap[categoryId] ?? '';
    const parsed = rawVal.trim() ? Number(rawVal.replace(',', '.')) : null;
    try {
      await updateCategoryBudget(
        categoryId,
        parsed != null && Number.isFinite(parsed) ? parsed : null,
        80,
      );
      setFeedbackMessage('Limite mensal atualizado.');
    } catch (err) {
      setIsError(true);
      setFeedbackMessage(
        err instanceof Error ? err.message : 'Erro ao atualizar orçamento.',
      );
    }
  };

  return (
    <Screen
      header={{
        title: 'Orçamentos e Categorias',
        subtitle: 'Defina tetos de gasto por categoria e acompanhe alertas em 80% e 100%.',
      }}
    >
      <View style={{ alignItems: 'flex-start', marginBottom: spacing.md }}>
        <MonthSwitcher
          value={filters.referenceYearMonth}
          onChange={setReferenceYearMonth}
        />
      </View>

      {feedbackMessage ? (
        <InlineMessage
          tone={isError ? 'danger' : 'success'}
          message={feedbackMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* Nova categoria personalizada */}
      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">Nova categoria</AppText>
        <SegmentedControl
          value={newKind}
          onChange={setNewKind}
          options={[
            { value: 'expense', label: 'Despesa' },
            { value: 'income', label: 'Receita' },
          ]}
        />
        <TextField
          label="Nome da categoria"
          placeholder="Ex.: Pet Shop, Farmácia, Academia"
          value={newName}
          onChangeText={setNewName}
        />
        {newKind === 'expense' ? (
          <TextField
            label="Orçamento mensal opcional"
            prefix="R$"
            placeholder="0,00"
            keyboardType="numeric"
            value={newBudgetText}
            onChangeText={setNewBudgetText}
          />
        ) : null}
        <Button
          label="Criar categoria"
          icon={Plus}
          onPress={() => void handleCreateCustomCategory()}
        />
      </Card>

      {/* Limites por categoria */}
      <Section>
        <SectionHeader
          title={`Categorias de despesa (${budgetStatuses.length})`}
          description="Toque em Salvar após informar o teto mensal desejado."
        />
        <View style={{ gap: spacing.md }}>
          {budgetStatuses.map((b) => {
            const currentInputVal =
              editingBudgetMap[b.categoryId] ??
              (b.monthlyBudget != null ? String(b.monthlyBudget) : '');
            const ratio =
              b.monthlyBudget && b.monthlyBudget > 0
                ? b.spentCompetenceAmount / b.monthlyBudget
                : 0;

            return (
              <Card key={b.categoryId} style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <CategoryIcon icon={b.icon} colorHex={b.colorHex} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{b.categoryName}</AppText>
                    <AppText variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
                      Gasto no mês: {formatCurrencyBRL(b.spentCompetenceAmount)}
                      {b.monthlyBudget != null
                        ? ` de ${formatCurrencyBRL(b.monthlyBudget)}`
                        : ' · Sem limite definido'}
                    </AppText>
                  </View>
                  {b.alertLevel === 'exceeded' ? (
                    <Badge tone="negative" label={`${b.usagePercent ?? 100}%`} />
                  ) : b.alertLevel === 'warning' ? (
                    <Badge tone="warning" label={`${b.usagePercent ?? 80}%`} />
                  ) : b.monthlyBudget != null ? (
                    <Badge tone="brand" label={`${b.usagePercent ?? 0}%`} />
                  ) : null}
                </View>

                {b.monthlyBudget != null ? (
                  <ProgressBar value={ratio} tone={budgetTone(b.alertLevel)} height={6} />
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      prefix="R$"
                      placeholder="Limite mensal"
                      keyboardType="numeric"
                      value={currentInputVal}
                      onChangeText={(val) =>
                        setEditingBudgetMap((prev) => ({
                          ...prev,
                          [b.categoryId]: val,
                        }))
                      }
                    />
                  </View>
                  <Button
                    label="Salvar"
                    variant="secondary"
                    onPress={() => void handleSaveBudget(b.categoryId)}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      </Section>
    </Screen>
  );
}
