import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { KeyRound, LogIn, Mail } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  AppText,
  BrandLogo,
  Button,
  Card,
  InlineMessage,
  Screen,
  spacing,
  TextField,
} from '@/ui';

export default function SignInScreen() {
  const router = useRouter();
  const profile = useFinanceStore((s) => s.profile);
  const switchAuthenticatedUserContext = useFinanceStore(
    (s) => s.switchAuthenticatedUserContext,
  );
  const hydrate = useFinanceStore((s) => s.hydrate);

  const [email, setEmail] = useState(profile?.email ?? '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);
    if (!email.trim().includes('@')) {
      setErrorMessage('Informe um endereço de e-mail válido.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured && password.trim().length >= 6) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          throw new Error(error.message);
        }
        if (data.user?.id) {
          switchAuthenticatedUserContext(data.user.id);
          await hydrate();
        }
      }

      const latestProfile = useFinanceStore.getState().profile;
      if (latestProfile?.onboarding_completed) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/onboarding');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível autenticar sua conta.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen
      header={{
        title: 'Entrar na sua conta',
        subtitle:
          'Acesse seu ambiente protegido por criptografia e isolamento Row Level Security (RLS).',
        showBack: true,
      }}
    >
      <BrandLogo size={38} style={{ marginBottom: spacing.xl }} />

      {errorMessage ? (
        <InlineMessage
          tone="danger"
          message={errorMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      <Card style={{ gap: spacing.lg }}>
        <TextField
          label="E-mail"
          icon={Mail}
          placeholder="seu.email@exemplo.com.br"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextField
          label="Senha de acesso"
          icon={KeyRound}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          label="Entrar"
          icon={LogIn}
          loading={isLoading}
          fullWidth
          onPress={() => void handleSignIn()}
        />
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <AppText variant="caption" tone="secondary" align="center">
          Ainda não configurou seus objetivos financeiros?
        </AppText>
        <Button
          label="Criar conta e definir objetivos"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/(auth)/sign-up')}
        />
      </View>
    </Screen>
  );
}
