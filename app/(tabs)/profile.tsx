import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Image, Platform, Pressable, Switch, View } from 'react-native';
import {
  Award,
  Camera,
  CreditCard,
  FileSpreadsheet,
  Flame,
  Landmark,
  Moon,
  ReceiptText,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { FINANCIAL_OBJECTIVE_OPTIONS } from '@/config/constants';
import { calculateMonthlyMetrics } from '@/domain/finance/cashflow-calculator';
import {
  GAMIFICATION_LEVELS,
  resolveGamificationLevel,
} from '@/domain/gamification/gamification-engine';
import { buildFinancialExcelWorkbook } from '@/domain/xlsx/excel-exporter';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, sumCurrencyExact } from '@/utils/currency';
import {
  AppText,
  Badge,
  BrandLogo,
  Button,
  Card,
  Divider,
  formatYearMonthLabel,
  InlineMessage,
  ListRow,
  ProgressBar,
  radius,
  Screen,
  Section,
  SectionHeader,
  SegmentedControl,
  spacing,
  TextField,
  useThemeColors,
} from '@/ui';

export default function ProfileAndExportScreen() {
  const router = useRouter();
  const c = useThemeColors();

  const profile = useFinanceStore((s) => s.profile);
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const cardInvoices = useFinanceStore((s) => s.cardInvoices);
  const receipts = useFinanceStore((s) => s.receipts);
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const financialGoals = useFinanceStore((s) => s.financialGoals);
  const goalsProgress = useFinanceStore((s) => s.goalsProgress);
  const userLevel = useFinanceStore((s) => s.userLevel);
  const filters = useFinanceStore((s) => s.filters);
  const themeMode = useFinanceStore((s) => s.themeMode);
  const avatarUri = useFinanceStore((s) => s.avatarUri);
  const monthlyObjectiveTargetAmount = useFinanceStore(
    (s) => s.monthlyObjectiveTargetAmount,
  );
  const setThemeMode = useFinanceStore((s) => s.setThemeMode);
  const setAvatarUri = useFinanceStore((s) => s.setAvatarUri);
  const setMonthlyObjectiveTargetAmount = useFinanceStore(
    (s) => s.setMonthlyObjectiveTargetAmount,
  );
  const evaluateCurrentMonthGamification = useFinanceStore(
    (s) => s.evaluateCurrentMonthGamification,
  );

  const [periodStart, setPeriodStart] = useState(`${filters.referenceYearMonth}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${filters.referenceYearMonth}-31`);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [customTargetInput, setCustomTargetInput] = useState(
    monthlyObjectiveTargetAmount != null ? String(monthlyObjectiveTargetAmount) : '',
  );
  const [targetSavedFeedback, setTargetSavedFeedback] = useState<string | null>(null);

  // 1. Foto de perfil
  const handlePickAvatar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      // Silencioso caso o usuário cancele a galeria
    }
  };

  // 2. Nível de gamificação e progresso até o próximo nível
  const gamificationInfo = useMemo(() => {
    const descriptor = resolveGamificationLevel(userLevel.total_points);
    const currentMin = descriptor.minPoints;
    const nextMin = descriptor.nextLevelPoints;
    const nextLevelObj = GAMIFICATION_LEVELS.find((l) => l.order === descriptor.order + 1);
    const progressRatio =
      nextMin != null && nextMin > currentMin
        ? Math.min(1, Math.max(0, (userLevel.total_points - currentMin) / (nextMin - currentMin)))
        : 1;
    const progressPercent = Math.round(progressRatio * 100);
    const pointsRemaining =
      nextMin != null ? Math.max(0, nextMin - userLevel.total_points) : 0;

    return {
      descriptor,
      nextTitle: nextLevelObj?.title ?? null,
      progressRatio,
      progressPercent,
      pointsRemaining,
    };
  }, [userLevel.total_points]);

  // 3. Barra em % do Objetivo Mensal
  const monthlyObjectiveProgress = useMemo(() => {
    const objectiveLabel =
      FINANCIAL_OBJECTIVE_OPTIONS.find((o) => o.value === profile?.primary_objective)
        ?.label ?? 'Economia e equilíbrio mensal';

    const monthMetrics = calculateMonthlyMetrics(
      transactions,
      filters.referenceYearMonth,
    );

    const goalsMonthlySum = sumCurrencyExact(
      financialGoals
        .filter((g) => g.status === 'active' && g.monthly_contribution_target != null)
        .map((g) => g.monthly_contribution_target ?? 0),
    );

    const fallbackIncomeTarget =
      profile?.monthly_net_income && profile.monthly_net_income > 0
        ? Math.round(profile.monthly_net_income * 0.2)
        : 500;

    const targetAmount =
      monthlyObjectiveTargetAmount != null && monthlyObjectiveTargetAmount > 0
        ? monthlyObjectiveTargetAmount
        : goalsMonthlySum > 0
          ? goalsMonthlySum
          : fallbackIncomeTarget;

    const monthContributions = sumCurrencyExact(
      goalsProgress
        .filter((gp) => gp.recorded_at.startsWith(filters.referenceYearMonth))
        .map((gp) => gp.contribution_amount),
    );

    const positiveCashSavings = Math.max(0, monthMetrics.cashFlowBalance);
    const achievedAmount = Math.max(positiveCashSavings, monthContributions);
    const ratio = targetAmount > 0 ? Math.min(1, achievedAmount / targetAmount) : 0;
    const percent = Math.round(ratio * 100);

    return {
      objectiveLabel,
      targetAmount,
      achievedAmount,
      remainingAmount: Math.max(0, targetAmount - achievedAmount),
      ratio,
      percent,
    };
  }, [
    profile,
    transactions,
    filters.referenceYearMonth,
    financialGoals,
    goalsProgress,
    monthlyObjectiveTargetAmount,
  ]);

  const handleSaveMonthlyTarget = () => {
    setTargetSavedFeedback(null);
    const cleaned = customTargetInput.trim().replace(/\./g, '').replace(',', '.');
    if (!cleaned) {
      setMonthlyObjectiveTargetAmount(null);
      setTargetSavedFeedback('Meta mensal restaurada para o cálculo automático.');
      return;
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      setMonthlyObjectiveTargetAmount(parsed);
      setTargetSavedFeedback(
        `Meta mensal definida em ${formatCurrencyBRL(parsed)}.`,
      );
    }
  };

  // Exportação XLSX
  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      const result = buildFinancialExcelWorkbook({
        periodStart,
        periodEnd,
        referenceYearMonth: filters.referenceYearMonth,
        userDisplayName: profile?.display_name ?? 'Titular',
        categories,
        transactions,
        creditCards,
        cardInvoices,
        receipts,
        receiptItems,
        financialGoals,
      });

      if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${result.fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, result.base64Content, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Exportar Relatório Financeiro (XLSX)',
          });
        }
        setExportStatus(
          `Arquivo ${result.fileName} gerado com ${result.sheetNames.length} abas.`,
        );
      } else {
        setExportStatus(
          `Planilha ${result.fileName} gerada (${result.sheetNames.length} abas).`,
        );
      }
    } catch (err) {
      setExportStatus(
        err instanceof Error ? err.message : 'Erro ao gerar planilha Excel.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Screen header={{ title: 'Perfil e Configurações' }}>
      <BrandLogo size={36} style={{ marginBottom: spacing.lg }} />

      {/* 1. Foto de Perfil + Identificação do Titular */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
            onPress={() => void handlePickAvatar()}
            style={{ position: 'relative' }}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  borderWidth: 2,
                  borderColor: c.brand,
                }}
              />
            ) : (
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: c.brandSoft,
                  borderWidth: 2,
                  borderColor: c.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserRound color={c.brand} size={34} />
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c.brand,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: c.surface,
              }}
            >
              <Camera color="#FFFFFF" size={14} />
            </View>
          </Pressable>

          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading">{profile?.display_name ?? 'Titular'}</AppText>
            <AppText variant="caption" tone="secondary">
              {profile?.email ?? 'Conta pessoal configurada'}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 }}>
              <Badge tone="brand" label={gamificationInfo.descriptor.title} />
              <Badge tone="positive" label={`${userLevel.total_points} XP`} />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label={avatarUri ? 'Trocar foto' : 'Colocar foto de perfil'}
            icon={Camera}
            variant="secondary"
            size="sm"
            onPress={() => void handlePickAvatar()}
          />
          {avatarUri ? (
            <Button
              label="Remover"
              icon={Trash2}
              variant="ghost"
              size="sm"
              onPress={() => setAvatarUri(null)}
            />
          ) : null}
        </View>
      </Card>

      {/* 4. Aparência: Modo Claro ou Escuro */}
      <Section>
        <SectionHeader
          title="Aparência do aplicativo"
          description="Escolha entre o tema claro ou o modo escuro inspirado em verde-floresta."
        />
        <Card style={{ gap: spacing.md }}>
          <SegmentedControl
            value={themeMode}
            onChange={setThemeMode}
            options={[
              { value: 'light', label: 'Modo Claro' },
              { value: 'dark', label: 'Modo Escuro' },
            ]}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {themeMode === 'dark' ? (
                <Moon color={c.accent} size={18} />
              ) : (
                <Sun color={c.brand} size={18} />
              )}
              <AppText variant="body">
                {themeMode === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado'}
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Alternar modo escuro"
              value={themeMode === 'dark'}
              onValueChange={(enabled) => setThemeMode(enabled ? 'dark' : 'light')}
              trackColor={{ false: c.borderStrong, true: c.brand }}
            />
          </View>
        </Card>
      </Section>

      {/* 3. Barra em % do Objetivo Mensal */}
      <Section>
        <SectionHeader
          title={`Objetivo mensal (${formatYearMonthLabel(filters.referenceYearMonth)})`}
          actionLabel="Ver metas"
          onAction={() => router.push('/goals')}
        />
        <Card style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="caption" tone="secondary">
                Foco principal
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {monthlyObjectiveProgress.objectiveLabel}
              </AppText>
            </View>
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: c.brandSoft,
              }}
            >
              <AppText
                variant="bodyStrong"
                tone="brand"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {monthlyObjectiveProgress.percent}%
              </AppText>
            </View>
          </View>

          <ProgressBar
            value={monthlyObjectiveProgress.ratio}
            tone="accent"
            height={10}
            accessibilityLabel={`Progresso do objetivo mensal: ${monthlyObjectiveProgress.percent}%`}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <AppText variant="caption" tone="secondary">
                Conquistado no mês
              </AppText>
              <AppText
                variant="bodyStrong"
                tone="positive"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCurrencyBRL(monthlyObjectiveProgress.achievedAmount)}
              </AppText>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AppText variant="caption" tone="secondary">
                Falta atingir
              </AppText>
              <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                {formatCurrencyBRL(monthlyObjectiveProgress.remainingAmount)}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption" tone="secondary">
                Meta do mês
              </AppText>
              <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                {formatCurrencyBRL(monthlyObjectiveProgress.targetAmount)}
              </AppText>
            </View>
          </View>

          <Divider />

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Definir meta mensal personalizada"
                prefix="R$"
                placeholder={String(monthlyObjectiveProgress.targetAmount)}
                keyboardType="numeric"
                value={customTargetInput}
                onChangeText={setCustomTargetInput}
              />
            </View>
            <Button
              label="Salvar meta"
              variant="secondary"
              onPress={handleSaveMonthlyTarget}
            />
          </View>

          {targetSavedFeedback ? (
            <InlineMessage tone="success" message={targetSavedFeedback} />
          ) : null}
        </Card>
      </Section>

      {/* 2. Nível da Gamificação e Hábitos */}
      <Section>
        <SectionHeader
          title="Nível da gamificação"
          actionLabel="Detalhes"
          onAction={() => router.push('/gamification')}
        />
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: c.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Award color={c.brand} size={24} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{gamificationInfo.descriptor.title}</AppText>
              <AppText variant="caption" tone="secondary">
                {gamificationInfo.descriptor.description}
              </AppText>
            </View>
          </View>

          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="secondary">
                {gamificationInfo.nextTitle
                  ? `Progresso para ${gamificationInfo.nextTitle}`
                  : 'Nível máximo alcançado'}
              </AppText>
              <AppText variant="caption" tone="brand" style={{ fontWeight: '600' }}>
                {gamificationInfo.progressPercent}% ({userLevel.total_points} XP)
              </AppText>
            </View>
            <ProgressBar
              value={gamificationInfo.progressRatio}
              tone="brand"
              height={8}
              accessibilityLabel={`Progresso de nível: ${gamificationInfo.progressPercent}%`}
            />
            {gamificationInfo.nextTitle ? (
              <AppText variant="caption" tone="tertiary">
                Faltam {gamificationInfo.pointsRemaining} pontos para subir de nível.
              </AppText>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: c.surfaceMuted,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Flame color={c.accent} size={18} />
              <View>
                <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {userLevel.active_streak_weeks} sem.
                </AppText>
                <AppText variant="caption" tone="secondary">
                  Constância ativa
                </AppText>
              </View>
            </View>
            <View style={{ width: 1, backgroundColor: c.border }} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Target color={c.brand} size={18} />
              <View>
                <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {userLevel.months_within_budget} m.
                </AppText>
                <AppText variant="caption" tone="secondary">
                  Dentro do orçamento
                </AppText>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Avaliar hábitos do mês"
              icon={RefreshCw}
              size="sm"
              onPress={() => void evaluateCurrentMonthGamification()}
            />
            <Button
              label="Ver histórico de XP"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/gamification')}
            />
          </View>
        </Card>
      </Section>

      {/* Atalhos dos módulos do app */}
      <Section>
        <SectionHeader title="Módulos e recursos" />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            onPress={() => router.push('/cards')}
            showChevron
            leading={<CreditCard color={c.brand} size={20} />}
            title="Cartões de crédito e faturas"
            subtitle="Limites, fechamento e pagamento sem dupla contagem"
          />
          <Divider inset={32} />
          <ListRow
            onPress={() => router.push('/goals')}
            showChevron
            leading={<Target color={c.brand} size={20} />}
            title="Metas financeiras"
            subtitle="Reserva de emergência, projetos e aportes"
          />
          <Divider inset={32} />
          <ListRow
            onPress={() => router.push('/(tabs)/scanner')}
            showChevron
            leading={<ReceiptText color={c.brand} size={20} />}
            title="Leitor de notas fiscais (NFC-e)"
            subtitle="QR Code SEFAZ-BA, importação XML e histórico de preços"
          />
          <Divider inset={32} />
          <ListRow
            onPress={() => router.push('/open-finance')}
            showChevron
            leading={<Landmark color={c.brand} size={20} />}
            title="Open Finance Brasil"
            subtitle="Consentimento, conciliação e revogação imediata"
          />
          <Divider inset={32} />
          <ListRow
            onPress={() => router.push('/(auth)/onboarding')}
            showChevron
            leading={<SlidersHorizontal color={c.brand} size={20} />}
            title="Objetivos e preferências"
            subtitle="Atualizar perfil de acompanhamento e categorias"
          />
        </Card>
      </Section>

      {/* Exportação Excel (.XLSX) */}
      <Section>
        <SectionHeader
          title="Exportar relatório Excel (.XLSX)"
          description="Planilha completa com 9 abas padronizadas em reais (R$)."
        />
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Início (AAAA-MM-DD)"
                value={periodStart}
                onChangeText={setPeriodStart}
                placeholder="2026-10-01"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Fim (AAAA-MM-DD)"
                value={periodEnd}
                onChangeText={setPeriodEnd}
                placeholder="2026-10-31"
              />
            </View>
          </View>

          {exportStatus ? (
            <InlineMessage tone="info" message={exportStatus} />
          ) : null}

          <Button
            label="Gerar e compartilhar Excel (.XLSX)"
            icon={FileSpreadsheet}
            loading={isExporting}
            onPress={() => void handleExportExcel()}
          />
        </Card>
      </Section>
    </Screen>
  );
}
