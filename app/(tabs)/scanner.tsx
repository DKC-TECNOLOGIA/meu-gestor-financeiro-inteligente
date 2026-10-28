import { StyleSheet, Text, View } from 'react-native';

export default function ScannerPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>FASE 3 • PRÓXIMA ETAPA</Text>
      <Text style={styles.title}>Leitor de Notas Fiscais (NFC-e BA)</Text>
      <Text style={styles.desc}>
        O scanner de QR Code via câmera, importador de XML fiscal e comparador histórico
        de preços por produto serão ativados na Fase 3 do plano de execução.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  badge: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  desc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
