import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { APP_CURRENCY, APP_TIMEZONE } from '@/config/constants';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.badge}>FINANCEIRO INTELIGENTE • ANDROID</Text>
        <Text style={styles.title}>
          Clareza sobre seus gastos, metas reais e decisões conscientes.
        </Text>
        <Text style={styles.subtitle}>
          Organize receitas, despesas e cartões sem dupla contagem, compare preços de
          notas fiscais (NFC-e), acompanhe seu orçamento mensal e exporte relatórios
          completos para Excel.
        </Text>

        <View style={styles.pillarsList}>
          <Text style={styles.pillarItem}>
            • Separação exata entre Regime de Competência e Fluxo de Caixa
          </Text>
          <Text style={styles.pillarItem}>
            • Privacidade e proteção de dados (LGPD + Row Level Security)
          </Text>
          <Text style={styles.pillarItem}>
            • Padrão regional: {APP_CURRENCY} (R$) • Fuso {APP_TIMEZONE}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Começar configuração e definir objetivos"
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/onboarding')}
        >
          <Text style={styles.primaryButtonText}>Começar e Definir Objetivos</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Já possuo conta e quero entrar"
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.secondaryButtonText}>Já tenho acesso configurado</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 24,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badge: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 12,
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  pillarsList: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  pillarItem: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#052E16',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
});
