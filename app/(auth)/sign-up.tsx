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

export default function SignUpScreen() {
  const router = useRouter();
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
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
          },
        });
        if (error) {
          throw new Error(error.message);
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>TELA 2 • CADASTRO E AUTENTICAÇÃO</Text>
        <Text style={styles.title}>Criar Conta Segura</Text>
        <Text style={styles.subtitle}>
          Seus dados são protegidos com isolamento individual por usuário (Row Level
          Security). Após criar o acesso, você definirá seus objetivos financeiros.
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Nome de exibição *</Text>
        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          placeholderTextColor="#64748B"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>E-mail *</Text>
        <TextInput
          style={styles.input}
          placeholder="voce@exemplo.com.br"
          placeholderTextColor="#64748B"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha (mínimo 6 caracteres) *</Text>
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
          style={styles.primaryBtn}
          onPress={() => void handleSignUp()}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#052E16" />
          ) : (
            <Text style={styles.primaryBtnText}>
              Criar Conta e Definir Objetivos
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkBtn}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.linkBtnText}>Já possui conta? Entrar</Text>
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
  badge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  errorBox: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 15,
  },
  linkBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
});
