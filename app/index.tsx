import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';

export default function IndexGateScreen() {
  const isHydrated = useFinanceStore((s) => s.isHydrated);
  const profile = useFinanceStore((s) => s.profile);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#34D399" />
        <Text style={styles.loadingText}>Carregando seu ambiente financeiro...</Text>
      </View>
    );
  }

  if (!profile || !profile.onboarding_completed) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 14,
  },
});
