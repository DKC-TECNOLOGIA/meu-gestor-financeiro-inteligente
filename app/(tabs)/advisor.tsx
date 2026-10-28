import { useEffect, useState } from 'react';
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
import { AiRecommendationStatusType } from '@/types/database.types';
import { formatCurrencyBRL } from '@/utils/currency';

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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>TELA 13 • INTELIGÊNCIA ARTIFICIAL</Text>
          <Text style={styles.title}>Orientador Financeiro</Text>
        </View>
        <View style={styles.navButtons}>
          <Pressable
            style={styles.navChip}
            onPress={() => router.push('/goals')}
          >
            <Text style={styles.navChipText}>Metas</Text>
          </Pressable>
          <Pressable
            style={styles.navChip}
            onPress={() => router.push('/gamification')}
          >
            <Text style={styles.navChipText}>Níveis</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Análises geradas sobre dados determinísticos reais do seu orçamento em{' '}
        {filters.referenceYearMonth}. Nunca inventamos transações, distinguimos fatos de
        estimativas e não recomendamos investimentos especulativos ou empréstimos.
      </Text>

      <Pressable
        style={styles.refreshBtn}
        onPress={() =>
          void generateAdvisorRecommendations(filters.referenceYearMonth)
        }
      >
        <Text style={styles.refreshBtnText}>
          Recalcular Recomendações com Dados Atuais
        </Text>
      </Pressable>

      {aiRecommendations.map((rec) => {
        const sup = rec.supporting_data as {
          facts?: Record<string, unknown>;
          estimates?: Record<string, unknown>;
        };

        return (
          <View key={rec.id} style={styles.recCard}>
            <View style={styles.recHeader}>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.statusBadge}>{rec.status.toUpperCase()}</Text>
            </View>

            {rec.requires_professional_review ? (
              <View style={styles.proWarningBox}>
                <Text style={styles.proWarningText}>
                  Situação complexa: recomendamos avaliação com profissional
                  certificado antes de tomar decisões contratuais.
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>1. Situação Identificada (Fato):</Text>
            <Text style={styles.fieldValue}>{rec.identified_situation}</Text>

            <Text style={styles.fieldLabel}>
              2. Dados Determinísticos que Fundamentam a Análise:
            </Text>
            <View style={styles.dataBox}>
              <Text style={styles.dataSubTitle}>Fatos Observados no Banco:</Text>
              {sup?.facts
                ? Object.entries(sup.facts).map(([k, v]) => (
                    <Text key={k} style={styles.dataLine}>
                      • {k}: {String(v)}
                    </Text>
                  ))
                : null}
              <Text style={[styles.dataSubTitle, { marginTop: 6 }]}>
                Estimativas Calculadas:
              </Text>
              {sup?.estimates
                ? Object.entries(sup.estimates).map(([k, v]) => (
                    <Text key={k} style={styles.dataLine}>
                      • {k}: {String(v)}
                    </Text>
                  ))
                : null}
            </View>

            <Text style={styles.fieldLabel}>
              3. Impacto Financeiro Estimado ({rec.is_impact_estimate ? 'Estimativa' : 'Fato'}):
            </Text>
            <Text style={styles.impactText}>
              {formatCurrencyBRL(rec.estimated_financial_impact)}
            </Text>

            <Text style={styles.fieldLabel}>4. Ação Concreta Sugerida:</Text>
            <Text style={styles.fieldValue}>{rec.suggested_action}</Text>

            <Text style={styles.fieldLabel}>5. Prazo / Frequência:</Text>
            <Text style={styles.fieldValue}>{rec.timeframe_or_frequency}</Text>

            <Text style={styles.fieldLabel}>6. Nível de Confiança:</Text>
            <Text style={styles.fieldValue}>{rec.confidence_level.toUpperCase()}</Text>

            <Text style={styles.fieldLabel}>7. Riscos e Limitações:</Text>
            <Text style={styles.fieldValue}>{rec.risks_and_limitations}</Text>

            <Text style={styles.fieldLabel}>
              8. Como Avaliar o Resultado Posteriormente:
            </Text>
            <Text style={styles.fieldValue}>{rec.evaluation_method}</Text>

            {/* Acompanhamento de resultado real */}
            <View style={styles.evalInputRow}>
              <TextInput
                style={styles.input}
                placeholder="Resultado real medido (R$ opcional)"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={
                  measuredImpactMap[rec.id] ??
                  (rec.actual_measured_impact != null
                    ? String(rec.actual_measured_impact)
                    : '')
                }
                onChangeText={(txt) =>
                  setMeasuredImpactMap((prev) => ({ ...prev, [rec.id]: txt }))
                }
              />
              <TextInput
                style={styles.input}
                placeholder="Observação de acompanhamento"
                placeholderTextColor="#64748B"
                value={feedbackMap[rec.id] ?? rec.user_feedback_notes ?? ''}
                onChangeText={(txt) =>
                  setFeedbackMap((prev) => ({ ...prev, [rec.id]: txt }))
                }
              />
            </View>

            {/* Botões: Aceitar, Adiar, Rejeitar, Concluir (Seção 11) */}
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#065F46' }]}
                onPress={() => void handleStatusChange(rec.id, 'accepted')}
              >
                <Text style={styles.actionBtnText}>Aceitar</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#1E3A8A' }]}
                onPress={() => void handleStatusChange(rec.id, 'postponed')}
              >
                <Text style={styles.actionBtnText}>Adiar</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#7F1D1D' }]}
                onPress={() => void handleStatusChange(rec.id, 'rejected')}
              >
                <Text style={styles.actionBtnText}>Rejeitar</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                onPress={() => void handleStatusChange(rec.id, 'completed')}
              >
                <Text style={[styles.actionBtnText, { color: '#052E16' }]}>
                  Concluída
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navChip: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  navChipText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshBtnText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 13,
  },
  recCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  statusBadge: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proWarningBox: {
    backgroundColor: '#451A03',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  proWarningText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 2,
  },
  fieldValue: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
  impactText: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: '800',
  },
  dataBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  dataSubTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  dataLine: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  evalInputRow: {
    marginTop: 12,
    gap: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
  },
});
