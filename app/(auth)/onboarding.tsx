import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  FINANCIAL_OBJECTIVE_OPTIONS,
  INITIAL_SYSTEM_CATEGORIES,
} from '@/config/constants';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import {
  FinancialObjectiveType,
  IncomeFrequencyType,
  TrackingProfileType,
} from '@/types/database.types';

function parseOptionalCurrency(text: string): number | null {
  const cleaned = text.trim().replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const existingProfile = useFinanceStore((s) => s.profile);
  const completeOnboarding = useFinanceStore((s) => s.completeOnboardingAndSaveProfile);
  const isLoading = useFinanceStore((s) => s.isLoading);

  const [displayName, setDisplayName] = useState(existingProfile?.display_name ?? '');
  const [email, setEmail] = useState(existingProfile?.email ?? '');
  const [primaryObjective, setPrimaryObjective] = useState<FinancialObjectiveType>(
    existingProfile?.primary_objective ?? 'family_budget',
  );
  const [customObjectiveDescription, setCustomObjectiveDescription] = useState(
    existingProfile?.custom_objective_description ?? '',
  );
  const [monthlyNetIncomeText, setMonthlyNetIncomeText] = useState(
    existingProfile?.monthly_net_income != null
      ? String(existingProfile.monthly_net_income)
      : '',
  );
  const [incomeFrequency, setIncomeFrequency] = useState<IncomeFrequencyType>(
    existingProfile?.income_frequency ?? 'monthly',
  );
  const [approxFixedExpensesText, setApproxFixedExpensesText] = useState(
    existingProfile?.approx_fixed_expenses != null
      ? String(existingProfile.approx_fixed_expenses)
      : '',
  );
  const [monthlyDebtInstallmentsText, setMonthlyDebtInstallmentsText] = useState(
    existingProfile?.monthly_debt_installments != null
      ? String(existingProfile.monthly_debt_installments)
      : '',
  );
  const [currentEmergencyFundText, setCurrentEmergencyFundText] = useState(
    existingProfile?.current_emergency_fund != null
      ? String(existingProfile.current_emergency_fund)
      : '',
  );
  const [trackingProfile, setTrackingProfile] = useState<TrackingProfileType>(
    existingProfile?.tracking_profile ?? 'balanced',
  );
  const [trackedCategorySlugs, setTrackedCategorySlugs] = useState<string[]>(
    existingProfile?.tracked_category_slugs &&
      existingProfile.tracked_category_slugs.length > 0
      ? existingProfile.tracked_category_slugs
      : ['moradia', 'alimentacao', 'supermercado', 'transporte', 'saude', 'lazer'],
  );
  const [privacyAccepted, setPrivacyAccepted] = useState(
    Boolean(existingProfile?.privacy_policy_accepted_at),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleCategorySlug = (slug: string) => {
    setTrackedCategorySlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleSave = async () => {
    setLocalError(null);
    try {
      await completeOnboarding({
        displayName,
        email,
        primaryObjective,
        customObjectiveDescription:
          primaryObjective === 'custom' ? customObjectiveDescription : null,
        monthlyNetIncome: parseOptionalCurrency(monthlyNetIncomeText),
        incomeFrequency,
        approxFixedExpenses: parseOptionalCurrency(approxFixedExpensesText),
        monthlyDebtInstallments: parseOptionalCurrency(monthlyDebtInstallmentsText),
        currentEmergencyFund: parseOptionalCurrency(currentEmergencyFundText),
        trackingProfile,
        trackedCategorySlugs,
        privacyPolicyAccepted: privacyAccepted,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'Verifique os campos obrigatórios antes de continuar.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerBadge}>PASSO INICIAL • PERSONALIZAÇÃO</Text>
      <Text style={styles.title}>Cadastro e Definição de Objetivos</Text>
      <Text style={styles.privacyNotice}>
        Finalidade dos dados: utilizamos estas informações exclusivamente para calibrar
        seus alertas de orçamento, calcular sua taxa de poupança e personalizar o
        Orientador Financeiro. Campos de renda, dívidas e reserva são opcionais e podem
        ser alterados a qualquer momento no seu Perfil.
      </Text>

      {localError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{localError}</Text>
        </View>
      ) : null}

      {/* 1. Identificação */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>1. Identificação</Text>
        <Text style={styles.label}>Nome de exibição *</Text>
        <TextInput
          style={styles.input}
          placeholder="Como prefere ser chamado(a)?"
          placeholderTextColor="#64748B"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>E-mail principal *</Text>
        <TextInput
          style={styles.input}
          placeholder="voce@exemplo.com.br"
          placeholderTextColor="#64748B"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {/* 2. Objetivo Financeiro Principal (10 opções) */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>2. Objetivo Financeiro Principal *</Text>
        <Text style={styles.helperText}>
          Escolha a prioridade número 1 para direcionar suas metas e recomendações:
        </Text>
        <View style={styles.optionsGrid}>
          {FINANCIAL_OBJECTIVE_OPTIONS.map((opt) => {
            const selected = primaryObjective === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.optionCard, selected && styles.optionCardSelected]}
                onPress={() => setPrimaryObjective(opt.value)}
              >
                <Text
                  style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                >
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </Pressable>
            );
          })}
        </View>

        {primaryObjective === 'custom' ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Descreva seu objetivo personalizado *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Quitar pós-graduação até dezembro"
              placeholderTextColor="#64748B"
              value={customObjectiveDescription}
              onChangeText={setCustomObjectiveDescription}
            />
          </View>
        ) : null}
      </View>

      {/* 3. Contexto Financeiro (Opcional) */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          3. Panorama Financeiro (Opcional — Você decide o que informar)
        </Text>

        <Text style={styles.label}>Renda mensal líquida aproximada (R$ — Opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 4500,00 (deixe em branco se preferir)"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={monthlyNetIncomeText}
          onChangeText={setMonthlyNetIncomeText}
        />

        <Text style={styles.label}>Frequência de recebimento</Text>
        <View style={styles.chipsRow}>
          {(
            [
              { value: 'monthly', label: 'Mensal' },
              { value: 'biweekly', label: 'Quinzenal' },
              { value: 'weekly', label: 'Semanal' },
              { value: 'variable', label: 'Variável/Autônomo' },
            ] as const
          ).map((freq) => {
            const active = incomeFrequency === freq.value;
            return (
              <Pressable
                key={freq.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setIncomeFrequency(freq.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {freq.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Despesas fixas aproximadas (R$ — Opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 2200,00"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={approxFixedExpensesText}
          onChangeText={setApproxFixedExpensesText}
        />

        <Text style={styles.label}>Dívidas e parcelas mensais (R$ — Opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 450,00"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={monthlyDebtInstallmentsText}
          onChangeText={setMonthlyDebtInstallmentsText}
        />

        <Text style={styles.label}>Reserva financeira atual (R$ — Opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 3000,00"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={currentEmergencyFundText}
          onChangeText={setCurrentEmergencyFundText}
        />
      </View>

      {/* 4. Perfil de Acompanhamento e Categorias */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>4. Perfil e Categorias de Acompanhamento</Text>
        <Text style={styles.label}>Nível de detalhe desejado</Text>
        <View style={styles.chipsRow}>
          {(
            [
              { value: 'essential', label: 'Essencial (Rápido)' },
              { value: 'balanced', label: 'Equilibrado' },
              { value: 'detailed', label: 'Detalhado (Analítico)' },
            ] as const
          ).map((prof) => {
            const active = trackingProfile === prof.value;
            return (
              <Pressable
                key={prof.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setTrackingProfile(prof.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {prof.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>
          Categorias que deseja acompanhar ({trackedCategorySlugs.length} selecionadas) *
        </Text>
        <View style={styles.chipsRow}>
          {INITIAL_SYSTEM_CATEGORIES.map((cat) => {
            const active = trackedCategorySlugs.includes(cat.slug);
            return (
              <Pressable
                key={cat.slug}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleCategorySlug(cat.slug)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 5. Consentimento de Privacidade */}
      <View style={styles.consentRow}>
        <Switch
          value={privacyAccepted}
          onValueChange={setPrivacyAccepted}
          trackColor={{ false: '#334155', true: '#10B981' }}
        />
        <Text style={styles.consentText}>
          Compreendo a finalidade dos dados e concordo com a Política de Privacidade
          (meus dados financeiros não são compartilhados nem usados para treinar IA).
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.submitButton}
        onPress={() => void handleSave()}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#052E16" />
        ) : (
          <Text style={styles.submitButtonText}>Salvar e Ir para o Dashboard</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    padding: 20,
    paddingBottom: 48,
  },
  headerBadge: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 16,
    marginBottom: 6,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  privacyNotice: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#38BDF8',
    marginBottom: 18,
  },
  errorBox: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 12,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 10,
  },
  optionsGrid: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B',
  },
  optionLabel: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: '#6EE7B7',
  },
  optionDesc: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 12,
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
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  consentText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#052E16',
    fontSize: 16,
    fontWeight: '800',
  },
});
