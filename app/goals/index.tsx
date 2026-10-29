import { useState } from 'react';
import { View } from 'react-native';
import { Plus, Target } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL } from '@/utils/currency';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineMessage,
  ProgressBar,
  Screen,
  Section,
  SectionHeader,
  spacing,
  TextField,
} from '@/ui';

export default function GoalsScreen() {
  const financialGoals = useFinanceStore((s) => s.financialGoals);
  const createFinancialGoal = useFinanceStore((s) => s.createFinancialGoal);
  const recordGoalContribution = useFinanceStore((s) => s.recordGoalContribution);

  const [goalName, setGoalName] = useState('');
  const [targetAmountText, setTargetAmountText] = useState('');
  const [monthlyTargetText, setMonthlyTargetText] = useState('');
  const [targetDate, setTargetDate] = useState('2027-06-30');
  const [contributionMap, setContributionMap] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleCreateGoal = async () => {
    setStatusMessage(null);
    setIsError(false);
    const targetVal = Number(targetAmountText.replace(',', '.'));
    const monthlyVal = monthlyTargetText.trim()
      ? Number(monthlyTargetText.replace(',', '.'))
      : null;

    try {
      await createFinancialGoal({
        name: goalName,
        objectiveType: 'emergency_fund',
        targetAmount: targetVal,
        currentAmount: 0,
        monthlyContributionTarget: monthlyVal,
        targetDate: targetDate.trim() || null,
      });
      setGoalName('');
      setTargetAmountText('');
      setMonthlyTargetText('');
      setStatusMessage('Meta financeira criada com sucesso.');
    } catch (err) {
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao criar meta financeira.',
      );
    }
  };

  const handleAddContribution = async (goalId: string) => {
    setStatusMessage(null);
    setIsError(false);
    const raw = contributionMap[goalId] ?? '';
    const val = Number(raw.replace(',', '.'));
    try {
      await recordGoalContribution(goalId, val, 'Aporte manual');
      setContributionMap((prev) => ({ ...prev, [goalId]: '' }));
      setStatusMessage('Aporte registrado e evolução atualizada.');
    } catch (err) {
      setIsError(true);
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao registrar aporte.',
      );
    }
  };

  return (
    <Screen
      header={{
        title: 'Metas Financeiras',
        subtitle: 'Acompanhe o valor desejado, acumulado e restante de cada objetivo.',
        showBack: true,
      }}
    >
      {statusMessage ? (
        <InlineMessage
          tone={isError ? 'danger' : 'success'}
          message={statusMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* Nova Meta */}
      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">Nova meta</AppText>
        <TextField
          label="Nome da meta"
          placeholder="Ex.: Reserva de Emergência (6 meses)"
          value={goalName}
          onChangeText={setGoalName}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Valor desejado"
              prefix="R$"
              placeholder="12000"
              keyboardType="numeric"
              value={targetAmountText}
              onChangeText={setTargetAmountText}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Aporte mensal"
              prefix="R$"
              placeholder="500"
              keyboardType="numeric"
              value={monthlyTargetText}
              onChangeText={setMonthlyTargetText}
            />
          </View>
        </View>
        <TextField
          label="Data alvo (AAAA-MM-DD)"
          placeholder="2027-06-30"
          value={targetDate}
          onChangeText={setTargetDate}
        />
        <Button
          label="Criar meta"
          icon={Plus}
          onPress={() => void handleCreateGoal()}
        />
      </Card>

      {/* Lista de Metas */}
      <Section>
        <SectionHeader title={`Suas metas (${financialGoals.length})`} />
        {financialGoals.length === 0 ? (
          <Card>
            <EmptyState
              icon={Target}
              title="Nenhuma meta criada ainda"
              description="Comece definindo sua reserva de emergência ou próximo objetivo."
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {financialGoals.map((goal) => {
              const ratio =
                goal.target_amount > 0
                  ? Math.min(1, goal.current_amount / goal.target_amount)
                  : 0;
              const pct = Math.round(ratio * 100);
              const remaining = Math.max(0, goal.target_amount - goal.current_amount);

              return (
                <Card key={goal.id} style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <AppText variant="heading" style={{ flex: 1 }}>
                      {goal.name}
                    </AppText>
                    <Badge
                      tone={goal.status === 'completed' ? 'positive' : 'brand'}
                      label={`${pct}%`}
                    />
                  </View>

                  <ProgressBar value={ratio} tone="accent" height={8} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <AppText variant="caption" tone="secondary">
                        Acumulado
                      </AppText>
                      <AppText variant="bodyStrong" tone="positive" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatCurrencyBRL(goal.current_amount)}
                      </AppText>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <AppText variant="caption" tone="secondary">
                        Restante
                      </AppText>
                      <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatCurrencyBRL(remaining)}
                      </AppText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <AppText variant="caption" tone="secondary">
                        Meta total
                      </AppText>
                      <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                        {formatCurrencyBRL(goal.target_amount)}
                      </AppText>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        prefix="R$"
                        placeholder="Valor do aporte"
                        keyboardType="numeric"
                        value={contributionMap[goal.id] ?? ''}
                        onChangeText={(val) =>
                          setContributionMap((prev) => ({
                            ...prev,
                            [goal.id]: val,
                          }))
                        }
                      />
                    </View>
                    <Button
                      label="Registrar aporte"
                      variant="secondary"
                      onPress={() => void handleAddContribution(goal.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </Section>
    </Screen>
  );
}
