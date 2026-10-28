import { z } from 'zod';
import { APP_CURRENCY, APP_LOCALE, APP_TIMEZONE } from './constants';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10).optional(),
  EXPO_PUBLIC_DEFAULT_TIMEZONE: z.string().default(APP_TIMEZONE),
  EXPO_PUBLIC_DEFAULT_CURRENCY: z.literal(APP_CURRENCY).default(APP_CURRENCY),
  EXPO_PUBLIC_DEFAULT_LOCALE: z.literal(APP_LOCALE).default(APP_LOCALE),
});

export type PublicAppEnv = z.infer<typeof envSchema>;

/**
 * Lê e valida as variáveis públicas de ambiente.
 * Também impede acidentalmente a presença de chaves privadas no bundle do cliente.
 */
export function getPublicEnv(
  rawEnv: Record<string, string | undefined> = process.env,
): PublicAppEnv {
  const forbiddenClientKeys = [
    'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'EXPO_PUBLIC_AI_API_KEY',
    'EXPO_PUBLIC_OPENAI_API_KEY',
    'EXPO_PUBLIC_GEMINI_API_KEY',
    'EXPO_PUBLIC_OPEN_FINANCE_CLIENT_SECRET',
  ];

  for (const key of forbiddenClientKeys) {
    if (rawEnv[key]) {
      throw new Error(
        `Violação de segurança crítica: a variável secreta "${key}" nunca deve usar o prefixo EXPO_PUBLIC_ no aplicativo móvel.`,
      );
    }
  }

  return envSchema.parse({
    EXPO_PUBLIC_SUPABASE_URL: rawEnv['EXPO_PUBLIC_SUPABASE_URL'],
    EXPO_PUBLIC_SUPABASE_ANON_KEY: rawEnv['EXPO_PUBLIC_SUPABASE_ANON_KEY'],
    EXPO_PUBLIC_DEFAULT_TIMEZONE: rawEnv['EXPO_PUBLIC_DEFAULT_TIMEZONE'] ?? APP_TIMEZONE,
    EXPO_PUBLIC_DEFAULT_CURRENCY: APP_CURRENCY,
    EXPO_PUBLIC_DEFAULT_LOCALE: APP_LOCALE,
  });
}
