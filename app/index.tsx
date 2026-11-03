import { Redirect } from 'expo-router';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { LoadingState, Screen } from '@/ui';

export default function IndexGateScreen() {
  const isHydrated = useFinanceStore((s) => s.isHydrated);
  const profile = useFinanceStore((s) => s.profile);

  if (!isHydrated) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Carregando seu ambiente financeiro..." />
      </Screen>
    );
  }

  if (!profile || !profile.onboarding_completed) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}
