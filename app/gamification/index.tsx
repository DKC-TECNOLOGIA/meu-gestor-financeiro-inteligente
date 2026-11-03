import { useEffect } from 'react';
import { View } from 'react-native';
import { Award, ShieldCheck } from 'lucide-react-native';
import {
  GAMIFICATION_LEVELS,
  resolveGamificationLevel,
} from '@/domain/gamification/gamification-engine';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatDateBR } from '@/utils/currency';
import {
  AppText,
  Badge,
  Card,
  Divider,
  EmptyState,
  InlineMessage,
  ListRow,
  ProgressBar,
  radius,
  Screen,
  Section,
  SectionHeader,
  spacing,
  useThemeColors,
} from '@/ui';

export default function GamificationScreen() {
  const c = useThemeColors();
  const userLevel = useFinanceStore((s) => s.userLevel);
  const gamificationEvents = useFinanceStore((s) => s.gamificationEvents);
  const evaluateGamification = useFinanceStore(
    (s) => s.evaluateCurrentMonthGamification,
  );

  useEffect(() => {
    void evaluateGamification();
  }, [evaluateGamification]);

  const currentDescriptor = resolveGamificationLevel(userLevel.total_points);
  const progressRatio =
    currentDescriptor.nextLevelPoints != null &&
    currentDescriptor.nextLevelPoints > currentDescriptor.minPoints
      ? Math.min(
          1,
          Math.max(
            0,
            (userLevel.total_points - currentDescriptor.minPoints) /
              (currentDescriptor.nextLevelPoints - currentDescriptor.minPoints),
          ),
        )
      : 1;

  return (
    <Screen
      header={{
        title: 'Níveis de Responsabilidade',
        subtitle: 'Evolução baseada na consistência dos seus hábitos de organização pessoal.',
        showBack: true,
      }}
    >
      <InlineMessage
        tone="info"
        title="Nota de transparência"
        message="Os níveis refletem exclusivamente a consistência dos seus hábitos de organização. Não constituem diagnóstico oficial de saúde financeira, não recompensam risco elevado e jamais penalizam despesas essenciais ou emergências."
        style={{ marginBottom: spacing.lg }}
      />

      {/* Card do Nível Atual */}
      <View
        style={{
          backgroundColor: c.brandDeep,
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="label" tone="onDeepMuted">
            NÍVEL ATUAL
          </AppText>
          <Badge tone="positive" label={`${userLevel.total_points} PTS AUDITADOS`} />
        </View>
        <AppText variant="title" tone="onDeep">
          {currentDescriptor.title}
        </AppText>
        <AppText variant="body" tone="onDeepMuted">
          {currentDescriptor.description}
        </AppText>
        <ProgressBar
          value={progressRatio}
          tone="onDeep"
          height={8}
          trackColor={c.brandDeepRaised}
        />
        <AppText variant="caption" tone="onDeep">
          {currentDescriptor.nextLevelPoints != null
            ? `Faltam ${Math.max(0, currentDescriptor.nextLevelPoints - userLevel.total_points)} pontos para o próximo nível.`
            : 'Você alcançou o nível máximo de consistência estratégica!'}
        </AppText>
      </View>

      {/* Escada dos 4 Níveis */}
      <Section>
        <SectionHeader
          title="Os 4 Níveis de Evolução"
          description="Pontuação progressiva e auditável."
        />
        <View style={{ gap: spacing.sm }}>
          {GAMIFICATION_LEVELS.map((lvl) => {
            const isCurrent = lvl.level === currentDescriptor.level;
            return (
              <Card
                key={lvl.level}
                style={{
                  borderColor: isCurrent ? c.brand : c.border,
                  borderWidth: isCurrent ? 1.5 : 1,
                  backgroundColor: isCurrent ? c.brandSoft : c.surface,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText variant="bodyStrong" tone={isCurrent ? 'brand' : 'default'}>
                    {lvl.title} ({lvl.minPoints}+ pts)
                  </AppText>
                  {isCurrent ? <Badge tone="brand" label="ATUAL" /> : null}
                </View>
                <AppText variant="caption" tone="secondary">
                  {lvl.description}
                </AppText>
              </Card>
            );
          })}
        </View>
      </Section>

      {/* Histórico Auditável de Eventos (Imutável) */}
      <Section>
        <SectionHeader
          title={`Histórico Auditável (${gamificationEvents.length})`}
          description="Eventos protegidos por chave de idempotência contra duplicidade."
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {gamificationEvents.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Nenhum evento pontuado ainda"
              description="Registre pelo menos 3 lançamentos no mês, cumpra um orçamento ou evolua em uma meta para ganhar seus primeiros pontos auditáveis."
            />
          ) : (
            gamificationEvents.map((ev, idx) => (
              <View key={ev.id}>
                {idx > 0 ? <Divider /> : null}
                <ListRow
                  leading={<ShieldCheck color={c.brand} size={20} />}
                  title={ev.reason_description}
                  subtitle={`${ev.rule_code} · ${formatDateBR(ev.occurred_at.slice(0, 10))} · ${ev.idempotency_key}`}
                  trailing={<Badge tone="positive" label={`+${ev.points_delta} pts`} />}
                />
              </View>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}
