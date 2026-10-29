import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Award, RefreshCw, Sparkles, Target } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { AiRecommendationStatusType } from '@/types/database.types';
import { formatCurrencyBRL } from '@/utils/currency';
import {
  AppText,
  Badge,
  Button,
  Card,
  colors,
  Divider,
  EmptyState,
  InlineMessage,
  Screen,
  spacing,
  TextField,
} from '@/ui';

export default function AdvisorScreen() {
  const router = useRouter();
  const aiRecommendations = useFinanceStore((s) => s.aiRecommendations);
  const filters = useFinanceStore((s) => s.filters);
  const generateAdvisorRecommendations = useFinanceStore(
    (s) => s.generateAdvisorRecommendationsForMonth,
  );
  const updateRecommendationStatus = useFinanceStore(
    (s) => s.updateAdvisorRecommendationStatus,
  );

  const [measuredImpactMap, setMeasuredImpactMap] = useState<Record<string, string>>(
    {},
  );
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  useEffect(() => {
    void generateAdvisorRecommendations(filters.referenceYearMonth);
  }, [filters.referenceYearMonth, generateAdvisorRecommendations]);

  const handleStatusChange = async (
    id: string,
    status: AiRecommendationStatusType,
  ) => {
    const rawImpact = measuredImpactMap[id];
    const parsedImpact =
      rawImpact && rawImpact.trim()
        ? Number(rawImpact.replace(',', '.'))
        : null;
    await updateRecommendationStatus(
      id,
      status,
      parsedImpact != null && Number.isFinite(parsedImpact) ? parsedImpact : null,
      feedbackMap[id] ?? null,
    );
  };

  return (
    <Screen
      header={{
        title: 'Orientador Financeiro',
        subtitle: `Análises determinísticas de ${filters.referenceYearMonth}, separando fatos observados de estimativas.`,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        <Button
          label="Recalcular"
          icon={RefreshCw}
          size="sm"
          onPress={() =>
            void generateAdvisorRecommendations(filters.referenceYearMonth)
          }
        />
        <Button
          label="Metas"
          icon={Target}
          variant="secondary"
          size="sm"
          onPress={() => router.push('/goals')}
        />
        <Button
          label="Níveis"
          icon={Award}
          variant="secondary"
          size="sm"
          onPress={() => router.push('/gamification')}
        />
      </View>

      {aiRecommendations.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Nenhuma recomendação para este período"
            description="Toque em Recalcular após registrar seus lançamentos do mês."
          />
        </Card>
      ) : (
        <View style={{ gap: spacing.lg }}>
          {aiRecommendations.map((rec) => {
            const sup = rec.supporting_data as {
              facts?: Record<string, unknown>;
              estimates?: Record<string, unknown>;
            };

            return (
              <Card key={rec.id} style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
                  <AppText variant="heading" style={{ flex: 1 }}>
                    {rec.title}
                  </AppText>
                  <Badge
                    tone={
                      rec.status === 'completed' || rec.status === 'accepted'
                        ? 'positive'
                        : rec.status === 'rejected'
                          ? 'neutral'
                          : 'brand'
                    }
                    label={rec.status.toUpperCase()}
                  />
                </View>

                {rec.requires_professional_review ? (
                  <InlineMessage
                    tone="warning"
                    message="Situação complexa: recomendamos avaliação com profissional certificado antes de tomar decisões contratuais."
                  />
                ) : null}

                <View style={{ gap: 2 }}>
                  <AppText variant="caption" tone="secondary">
                    Situação identificada (fato)
                  </AppText>
                  <AppText variant="body">{rec.identified_situation}</AppText>
                </View>

                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 10,
                    padding: spacing.md,
                    gap: 4,
                  }}
                >
                  <AppText variant="caption" tone="secondary" style={{ fontWeight: '600' }}>
                    Fatos observados
                  </AppText>
                  {sup?.facts
                    ? Object.entries(sup.facts).map(([k, v]) => (
                        <AppText key={k} variant="caption">
                          • {k}: {String(v)}
                        </AppText>
                      ))
                    : null}
                  {sup?.estimates && Object.keys(sup.estimates).length > 0 ? (
                    <>
                      <AppText variant="caption" tone="secondary" style={{ fontWeight: '600', marginTop: 4 }}>
                        Estimativas calculadas
                      </AppText>
                      {Object.entries(sup.estimates).map(([k, v]) => (
                        <AppText key={k} variant="caption">
                          • {k}: {String(v)}
                        </AppText>
                      ))}
                    </>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AppText variant="caption" tone="secondary">
                    Impacto estimado ({rec.is_impact_estimate ? 'estimativa' : 'fato'})
                  </AppText>
                  <AppText variant="amountLarge" tone="positive">
                    {formatCurrencyBRL(rec.estimated_financial_impact)}
                  </AppText>
                </View>

                <Divider />

                <View style={{ gap: 2 }}>
                  <AppText variant="caption" tone="secondary">
                    Ação sugerida ({rec.timeframe_or_frequency} · confiança {rec.confidence_level})
                  </AppText>
                  <AppText variant="bodyStrong">{rec.suggested_action}</AppText>
                </View>

                <View style={{ gap: 2 }}>
                  <AppText variant="caption" tone="secondary">
                    Riscos e limitações
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    {rec.risks_and_limitations}
                  </AppText>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      prefix="R$"
                      placeholder="Economia real obtida"
                      keyboardType="numeric"
                      value={measuredImpactMap[rec.id] ?? ''}
                      onChangeText={(val) =>
                        setMeasuredImpactMap((prev) => ({ ...prev, [rec.id]: val }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextField
                      placeholder="Observação opcional"
                      value={feedbackMap[rec.id] ?? ''}
                      onChangeText={(val) =>
                        setFeedbackMap((prev) => ({ ...prev, [rec.id]: val }))
                      }
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  <Button
                    label="Concluída"
                    size="sm"
                    onPress={() => void handleStatusChange(rec.id, 'completed')}
                  />
                  <Button
                    label="Aceitar"
                    variant="secondary"
                    size="sm"
                    onPress={() => void handleStatusChange(rec.id, 'accepted')}
                  />
                  <Button
                    label="Adiar"
                    variant="secondary"
                    size="sm"
                    onPress={() => void handleStatusChange(rec.id, 'postponed')}
                  />
                  <Button
                    label="Ignorar"
                    variant="ghost"
                    size="sm"
                    onPress={() => void handleStatusChange(rec.id, 'rejected')}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
