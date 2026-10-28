import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useFinanceStore } from '@/features/finance/use-finance-store';

export default function SignInScreen() {
  const router = useRouter();
  const profile = useFinanceStore((s) => s.profile);
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
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          throw new Error(error.message);
        }
      }

      if (profile?.onboarding_completed) {
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Autenticação Segura</Text>
        <Text style={styles.subtitle}>
          Acesse sua conta protegida por criptografia e isolamento Row Level Security
          (RLS).
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="seu.email@exemplo.com.br"
          placeholderTextColor="#64748B"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha de acesso</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#64748B"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={() => void handleSignIn()}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#052E16" />
          ) : (
            <Text style={styles.primaryButtonText}>Entrar</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.linkButton}
          onPress={() => router.push('/(auth)/onboarding')}
        >
          <Text style={styles.linkButtonText}>
            Ainda não configurou seus objetivos? Iniciar cadastro
          </Text>
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
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#052E16',
    fontSize: 16,
    fontWeight: '800',
  },
  linkButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
});
