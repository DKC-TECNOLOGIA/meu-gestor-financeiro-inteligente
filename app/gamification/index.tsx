import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GAMIFICATION_LEVELS,
  resolveGamificationLevel,
} from '@/domain/gamification/gamification-engine';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatDateBR } from '@/utils/currency';

export default function GamificationScreen() {
  const router = useRouter();
  const userLevel = useFinanceStore((s) => s.userLevel);
  const gamificationEvents = useFinanceStore((s) => s.gamificationEvents);
  const evaluateGamification = useFinanceStore(
    (s) => s.evaluateCurrentMonthGamification,
  );

  useEffect(() => {
    void evaluateGamification();
  }, [evaluateGamification]);

  const currentDescriptor = resolveGamificationLevel(userLevel.total_points);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>TELA 14 • EVOLUÇÃO DE HÁBITOS</Text>
      <Text style={styles.title}>Níveis de Responsabilidade Financeira</Text>
      <Text style={styles.disclaimer}>
        Nota de transparência: Os níveis refletem exclusivamente a consistência dos seus
        hábitos de organização e evolução pessoal. Não constituem diagnóstico oficial de
        saúde financeira, não recompensam risco elevado ou renda alta e jamais penalizam
        despesas essenciais ou emergências.
      </Text>

      {/* Card do Nível Atual */}
      <View style={styles.levelHero}>
        <Text style={styles.levelBadge}>NÍVEL ATUAL</Text>
        <Text style={styles.levelTitle}>{currentDescriptor.title}</Text>
        <Text style={styles.pointsText}>{userLevel.total_points} pontos auditados</Text>
        <Text style={styles.levelDesc}>{currentDescriptor.description}</Text>
        {currentDescriptor.nextLevelPoints != null ? (
          <Text style={styles.nextLevelHint}>
            Faltam{' '}
            {Math.max(0, currentDescriptor.nextLevelPoints - userLevel.total_points)}{' '}
            pontos para o próximo nível.
          </Text>
        ) : (
          <Text style={styles.nextLevelHint}>
            Você alcançou o nível máximo de consistência estratégica!
          </Text>
        )}
      </View>

      {/* Escada dos 4 Níveis */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Os 4 Níveis de Evolução</Text>
        {GAMIFICATION_LEVELS.map((lvl) => {
          const isCurrent = lvl.level === currentDescriptor.level;
          return (
            <View
              key={lvl.level}
              style={[styles.lvlRow, isCurrent && styles.lvlRowCurrent]}
            >
              <Text style={styles.lvlName}>
                {lvl.title} ({lvl.minPoints}+ pts)
              </Text>
              <Text style={styles.lvlSub}>{lvl.description}</Text>
            </View>
          );
        })}
      </View>

      {/* Histórico Auditável de Eventos (Imutável) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Histórico Auditável de Pontuação ({gamificationEvents.length})
        </Text>
        {gamificationEvents.length === 0 ? (
          <Text style={styles.emptyText}>
            Registre pelo menos 3 lançamentos no mês, cumpra um orçamento ou evolua em
            uma meta para ganhar seus primeiros pontos auditáveis.
          </Text>
        ) : (
          gamificationEvents.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventReason}>{ev.reason_description}</Text>
                <Text style={styles.eventMeta}>
                  Regra: {ev.rule_code} • Data:{' '}
                  {formatDateBR(ev.occurred_at.slice(0, 10))} • Chave:{' '}
                  {ev.idempotency_key}
                </Text>
              </View>
              <Text style={styles.eventPoints}>+{ev.points_delta} pts</Text>
            </View>
          ))
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
    marginBottom: 8,
  },
  disclaimer: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  levelHero: {
    backgroundColor: '#064E3B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  levelBadge: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800',
  },
  levelTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4,
  },
  pointsText: {
    color: '#34D399',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  levelDesc: {
    color: '#D1FAE5',
    fontSize: 13,
    lineHeight: 19,
  },
  nextLevelHint: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
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
    marginBottom: 10,
  },
  lvlRow: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#0F172A',
  },
  lvlRowCurrent: {
    borderWidth: 1,
    borderColor: '#10B981',
  },
  lvlName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  lvlSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  eventReason: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  eventMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  eventPoints: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
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
