import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { KeyRound, Mail, UserPlus, UserRound } from 'lucide-react-native';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  AppText,
  Badge,
  BrandLogo,
  Button,
  Card,
  InlineMessage,
  Screen,
  spacing,
  TextField,
} from '@/ui';

export default function SignUpScreen() {
  const router = useRouter();
  const switchAuthenticatedUserContext = useFinanceStore(
    (s) => s.switchAuthenticatedUserContext,
  );

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignUp = async () => {
    setErrorMessage(null);
    if (displayName.trim().length < 2) {
      setErrorMessage('Informe seu nome de exibição.');
      return;
    }
    if (!email.trim().includes('@')) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });
        if (error) {
          throw new Error(error.message);
        }
        if (data.user?.id) {
          switchAuthenticatedUserContext(data.user.id);
        }
      }
      router.replace('/(auth)/onboarding');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao criar conta.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen
      header={{
        title: 'Criar Conta Segura',
        subtitle:
          'Seus dados são protegidos com isolamento individual por usuário (Row Level Security).',
        showBack: true,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <BrandLogo size={36} />
        <Badge tone="brand" label="CADASTRO SEGURO" />
      </View>

      {errorMessage ? (
        <InlineMessage
          tone="danger"
          message={errorMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      <Card style={{ gap: spacing.lg }}>
        <TextField
          label="Nome de exibição *"
          icon={UserRound}
          placeholder="Seu nome"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TextField
          label="E-mail *"
          icon={Mail}
          placeholder="voce@exemplo.com.br"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextField
          label="Senha (mínimo 6 caracteres) *"
          icon={KeyRound}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          label="Criar Conta e Definir Objetivos"
          icon={UserPlus}
          loading={isLoading}
          fullWidth
          onPress={() => void handleSignUp()}
        />
      </Card>

      <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
        <AppText variant="caption" tone="secondary" align="center">
          Já possui conta cadastrada?
        </AppText>
        <Button
          label="Entrar na conta existente"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/(auth)/sign-in')}
        />
      </View>
    </Screen>
  );
}
