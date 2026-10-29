import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Check, Lock, Sparkles, TrendingUp } from 'lucide-react-native';
import { APP_CURRENCY, APP_TIMEZONE } from '@/config/constants';
import {
  AppText,
  BrandLogo,
  Button,
  Card,
  colors,
  Screen,
  spacing,
} from '@/ui';

export default function WelcomeScreen() {
  const router = useRouter();

  const pillars = [
    {
      icon: TrendingUp,
      title: 'Competência e caixa sem dupla contagem',
      desc: 'Compras no cartão entram no mês da compra; pagar a fatura baixa o caixa sem duplicar gastos.',
    },
    {
      icon: Sparkles,
      title: 'Notas fiscais (NFC-e) e orientação determinística',
      desc: 'Escaneie QR Codes, compare preços por unidade e receba análises baseadas apenas em fatos.',
    },
    {
      icon: Lock,
      title: 'Privacidade e isolamento por linha (RLS)',
      desc: `Seus dados protegidos com ${APP_CURRENCY} (R$) e fuso ${APP_TIMEZONE}.`,
    },
  ];

  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Começar e definir objetivos"
            fullWidth
            onPress={() => router.push('/(auth)/onboarding')}
          />
          <Button
            label="Já tenho conta configurada"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/(auth)/sign-in')}
          />
        </View>
      }
    >
      <View style={{ paddingTop: spacing.xl, gap: spacing.xl }}>
        <BrandLogo size={48} />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" style={{ fontSize: 28, lineHeight: 34 }}>
            Clareza sobre seu dinheiro, todos os dias.
          </AppText>
          <AppText variant="body" tone="secondary">
            Organize receitas, despesas, cartões, metas e notas fiscais em uma
            interface limpa, pensada para decisões tranquilas.
          </AppText>
        </View>

        <Card style={{ gap: spacing.lg }}>
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <View
                key={p.title}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.brandSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  <Icon color={colors.brand} size={18} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{p.title}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {p.desc}
                  </AppText>
                </View>
                <Check color={colors.accent} size={16} style={{ marginTop: 4 }} />
              </View>
            );
          })}
        </Card>
      </View>
    </Screen>
  );
}
