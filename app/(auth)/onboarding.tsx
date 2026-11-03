import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Switch, View } from 'react-native';
import { Check, Mail, ShieldCheck, UserRound } from 'lucide-react-native';
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
import {
  AppText,
  Badge,
  BrandLogo,
  Button,
  Card,
  Chip,
  InlineMessage,
  radius,
  Screen,
  Section,
  SectionHeader,
  SegmentedControl,
  spacing,
  TextField,
  useThemeColors,
} from '@/ui';

function parseOptionalCurrency(text: string): number | null {
  const cleaned = text.trim().replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const c = useThemeColors();
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
    <Screen
      header={{
        title: 'Objetivos e Perfil Financeiro',
        subtitle: 'Personalize seus alertas de orçamento, metas e recomendações.',
        showBack: Boolean(existingProfile?.onboarding_completed),
      }}
      footer={
        <Button
          label="Salvar e Ir para o Dashboard"
          icon={Check}
          loading={isLoading}
          fullWidth
          onPress={() => void handleSave()}
        />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <BrandLogo size={34} />
        <Badge tone="brand" label="PERSONALIZAÇÃO" />
      </View>

      <InlineMessage
        tone="info"
        title="Finalidade e Minimização de Dados (LGPD)"
        message="Utilizamos estas informações exclusivamente para calibrar seus alertas de orçamento, calcular sua taxa de poupança e personalizar o Orientador Financeiro. Campos de renda, dívidas e reserva são opcionais."
        style={{ marginBottom: spacing.lg }}
      />

      {localError ? (
        <InlineMessage
          tone="danger"
          message={localError}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* 1. Identificação */}
      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">1. Identificação</AppText>
        <TextField
          label="Nome de exibição *"
          icon={UserRound}
          placeholder="Como prefere ser chamado(a)?"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label="E-mail principal *"
          icon={Mail}
          placeholder="voce@exemplo.com.br"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </Card>

      {/* 2. Objetivo Financeiro Principal (10 opções) */}
      <Section>
        <SectionHeader
          title="2. Objetivo Financeiro Principal *"
          description="Escolha a prioridade número 1 para direcionar suas metas e recomendações."
        />
        <View style={{ gap: spacing.sm }}>
          {FINANCIAL_OBJECTIVE_OPTIONS.map((opt) => {
            const selected = primaryObjective === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setPrimaryObjective(opt.value)}
                style={{
                  backgroundColor: selected ? c.brandSoft : c.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? c.brand : c.border,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText
                    variant="bodyStrong"
                    tone={selected ? 'brand' : 'default'}
                    style={{ flex: 1 }}
                  >
                    {opt.label}
                  </AppText>
                  {selected ? <Check color={c.brand} size={18} /> : null}
                </View>
                <AppText variant="caption" tone="secondary">
                  {opt.description}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {primaryObjective === 'custom' ? (
          <Card style={{ marginTop: spacing.md }}>
            <TextField
              label="Descreva seu objetivo personalizado *"
              placeholder="Ex.: Quitar pós-graduação até dezembro"
              value={customObjectiveDescription}
              onChangeText={setCustomObjectiveDescription}
            />
          </Card>
        ) : null}
      </Section>

      {/* 3. Contexto Financeiro (Opcional) */}
      <Section>
        <SectionHeader
          title="3. Panorama Financeiro (Opcional)"
          description="Você decide o que informar. Deixe em branco o que preferir não preencher."
        />
        <Card style={{ gap: spacing.md }}>
          <TextField
            label="Renda mensal líquida aproximada (Opcional)"
            prefix="R$"
            placeholder="Ex.: 4500,00"
            keyboardType="numeric"
            value={monthlyNetIncomeText}
            onChangeText={setMonthlyNetIncomeText}
          />

          <View style={{ gap: spacing.xs }}>
            <AppText variant="label" tone="secondary">
              Frequência de recebimento
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(
                [
                  { value: 'monthly', label: 'Mensal' },
                  { value: 'biweekly', label: 'Quinzenal' },
                  { value: 'weekly', label: 'Semanal' },
                  { value: 'variable', label: 'Variável/Autônomo' },
                ] as const
              ).map((freq) => (
                <Chip
                  key={freq.value}
                  label={freq.label}
                  selected={incomeFrequency === freq.value}
                  onPress={() => setIncomeFrequency(freq.value)}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Despesas fixas aproximadas (Opcional)"
            prefix="R$"
            placeholder="Ex.: 2200,00"
            keyboardType="numeric"
            value={approxFixedExpensesText}
            onChangeText={setApproxFixedExpensesText}
          />

          <TextField
            label="Dívidas e parcelas mensais (Opcional)"
            prefix="R$"
            placeholder="Ex.: 450,00"
            keyboardType="numeric"
            value={monthlyDebtInstallmentsText}
            onChangeText={setMonthlyDebtInstallmentsText}
          />

          <TextField
            label="Reserva financeira atual (Opcional)"
            prefix="R$"
            placeholder="Ex.: 3000,00"
            keyboardType="numeric"
            value={currentEmergencyFundText}
            onChangeText={setCurrentEmergencyFundText}
          />
        </Card>
      </Section>

      {/* 4. Perfil de Acompanhamento e Categorias */}
      <Section>
        <SectionHeader
          title="4. Perfil e Categorias de Acompanhamento"
          description="Escolha o nível de detalhe e quais categorias deseja monitorar."
        />
        <Card style={{ gap: spacing.md }}>
          <SegmentedControl
            value={trackingProfile}
            onChange={setTrackingProfile}
            options={[
              { value: 'essential', label: 'Essencial' },
              { value: 'balanced', label: 'Equilibrado' },
              { value: 'detailed', label: 'Detalhado' },
            ]}
          />

          <AppText variant="label" tone="secondary">
            Categorias selecionadas ({trackedCategorySlugs.length}) *
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {INITIAL_SYSTEM_CATEGORIES.map((cat) => (
              <Chip
                key={cat.slug}
                label={cat.name}
                selected={trackedCategorySlugs.includes(cat.slug)}
                onPress={() => toggleCategorySlug(cat.slug)}
              />
            ))}
          </View>
        </Card>
      </Section>

      {/* 5. Consentimento de Privacidade */}
      <Section>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <ShieldCheck color={c.brand} size={22} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">
                Compreendo a finalidade dos dados e concordo com a Política de Privacidade
                (meus dados financeiros não são compartilhados nem usados para treinar IA).
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Concordar com a Política de Privacidade"
              value={privacyAccepted}
              onValueChange={setPrivacyAccepted}
              trackColor={{ false: c.borderStrong, true: c.brand }}
            />
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
