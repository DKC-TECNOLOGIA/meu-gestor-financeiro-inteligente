import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL } from '@/utils/currency';

export default function GoalsScreen() {
  const router = useRouter();
  const financialGoals = useFinanceStore((s) => s.financialGoals);
  const createFinancialGoal = useFinanceStore((s) => s.createFinancialGoal);
  const recordGoalContribution = useFinanceStore((s) => s.recordGoalContribution);

  const [goalName, setGoalName] = useState('');
  const [targetAmountText, setTargetAmountText] = useState('');
  const [monthlyTargetText, setMonthlyTargetText] = useState('');
  const [targetDate, setTargetDate] = useState('2027-06-30');
  const [contributionMap, setContributionMap] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCreateGoal = async () => {
    setStatusMessage(null);
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
      setStatusMessage('Meta financeira criada com sucesso!');
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao criar meta financeira.',
      );
    }
  };

  const handleAddContribution = async (goalId: string) => {
    setStatusMessage(null);
    const raw = contributionMap[goalId] ?? '';
    const val = Number(raw.replace(',', '.'));
    try {
      await recordGoalContribution(goalId, val, 'Aporte manual');
      setContributionMap((prev) => ({ ...prev, [goalId]: '' }));
      setStatusMessage('Aporte registrado e evolução atualizada!');
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Erro ao registrar aporte.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 12 • PLANEJAMENTO DE METAS</Text>
      <Text style={styles.title}>Metas Financeiras e Evolução</Text>
      <Text style={styles.subtitle}>
        Defina objetivos claros, acompanhe seus aportes mensais e evolua nos níveis de
        responsabilidade financeira.
      </Text>

      {statusMessage ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      {/* Nova Meta */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Criar Nova Meta</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome da meta (ex.: Reserva de Emergência 6 meses)"
          placeholderTextColor="#64748B"
          value={goalName}
          onChangeText={setGoalName}
        />
        <TextInput
          style={styles.input}
          placeholder="Valor alvo em R$ (ex.: 12000)"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={targetAmountText}
          onChangeText={setTargetAmountText}
        />
        <TextInput
          style={styles.input}
          placeholder="Aporte mensal planejado opcional (R$)"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={monthlyTargetText}
          onChangeText={setMonthlyTargetText}
        />
        <TextInput
          style={styles.input}
          placeholder="Data alvo (AAAA-MM-DD)"
          placeholderTextColor="#64748B"
          value={targetDate}
          onChangeText={setTargetDate}
        />

        <Pressable
          style={styles.primaryBtn}
          onPress={() => void handleCreateGoal()}
        >
          <Text style={styles.primaryBtnText}>Adicionar Meta</Text>
        </Pressable>
      </View>

      {/* Lista de Metas */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Suas Metas ({financialGoals.length})
        </Text>
        {financialGoals.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhuma meta criada ainda. Comece definindo sua Reserva de Emergência!
          </Text>
        ) : (
          financialGoals.map((goal) => {
            const pct =
              goal.target_amount > 0
                ? Math.min(
                    100,
                    Math.round((goal.current_amount / goal.target_amount) * 100),
                  )
                : 0;

            return (
              <View key={goal.id} style={styles.goalItem}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalPct}>{pct}%</Text>
                </View>

                <Text style={styles.goalMeta}>
                  Acumulado: {formatCurrencyBRL(goal.current_amount)} de{' '}
                  {formatCurrencyBRL(goal.target_amount)} ({goal.status})
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>

                <View style={styles.contribRow}>
                  <TextInput
                    style={styles.contribInput}
                    placeholder="Novo aporte R$"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={contributionMap[goal.id] ?? ''}
                    onChangeText={(txt) =>
                      setContributionMap((prev) => ({ ...prev, [goal.id]: txt }))
                    }
                  />
                  <Pressable
                    style={styles.contribBtn}
                    onPress={() => void handleAddContribution(goal.id)}
                  >
                    <Text style={styles.contribBtnText}>+ Aportar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>Voltar</Text>
      </Pressable>
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
  badge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  statusBox: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statusText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 14,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  goalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  goalName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  goalPct: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
  },
  goalMeta: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 8,
  },
  barTrack: {
    height: 10,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  contribRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contribInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  contribBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 8,
  },
  contribBtnText: {
    color: '#082F49',
    fontWeight: '800',
    fontSize: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
});
