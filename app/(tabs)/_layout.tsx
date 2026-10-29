import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, ListOrdered, PieChart, Sparkles, UserRound } from 'lucide-react-native';
import { useThemeColors } from '@/ui';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.textTertiary,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <House color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Lançamentos',
          tabBarIcon: ({ color, size }) => <ListOrdered color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Orçamentos',
          tabBarIcon: ({ color, size }) => <PieChart color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="advisor"
        options={{
          title: 'Orientador',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen name="scanner" options={{ href: null, title: 'Ler nota fiscal' }} />
    </Tabs>
  );
}
