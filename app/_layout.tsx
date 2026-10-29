import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { useThemeColors } from '@/ui';

export default function RootLayout() {
  const hydrate = useFinanceStore((s) => s.hydrate);
  const themeMode = useFinanceStore((s) => s.themeMode);
  const c = useThemeColors();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: c.background },
        }}
      />
    </SafeAreaProvider>
  );
}
