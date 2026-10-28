import { StyleSheet, Text, View } from 'react-native';
import { APP_CURRENCY, APP_TIMEZONE } from '@/config/constants';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>FASE 1 • FUNDAÇÃO CONCLUÍDA</Text>
      <Text style={styles.title}>Financeiro Inteligente</Text>
      <Text style={styles.subtitle}>
        Gestão financeira pessoal, comparação de preços via NFC-e, metas e Orientador
        Financeiro.
      </Text>
      <View style={styles.metaBox}>
        <Text style={styles.metaText}>Moeda padrão: {APP_CURRENCY} (R$)</Text>
        <Text style={styles.metaText}>Fuso horário: {APP_TIMEZONE}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  metaBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metaText: {
    color: '#E2E8F0',
    fontSize: 14,
    marginVertical: 2,
  },
});
