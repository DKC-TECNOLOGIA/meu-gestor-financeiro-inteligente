/**
 * Supabase Edge Function: ai-advisor
 * Orientador Financeiro (Seção 11 e Seção 14):
 * - Chamada exclusivamente pelo backend com JWT autenticado.
 * - Recebe apenas os agregados determinísticos calculados pelo banco/aplicação.
 * - Proteção contra abuso / rate limit por usuário.
 * - Não expõe chaves privadas no aplicativo móvel.
 * - Nunca recomenda investimentos específicos, operações especulativas ou novos empréstimos automáticos.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const rateLimitWindowMs = 60_000;
const maxRequestsPerMinute = 5;
const requestCounters = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userKey: string): boolean {
  const now = Date.now();
  const entry = requestCounters.get(userKey);
  if (!entry || now > entry.resetAt) {
    requestCounters.set(userKey, { count: 1, resetAt: now + rateLimitWindowMs });
    return true;
  }
  if (entry.count >= maxRequestsPerMinute) {
    return false;
  }
  entry.count += 1;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado: token JWT obrigatório.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tokenKey = authHeader.slice(-24);
    if (!checkRateLimit(tokenKey)) {
      return new Response(
        JSON.stringify({
          error:
            'Limite de solicitações ao Orientador Financeiro atingido. Aguarde 1 minuto antes de gerar novas análises.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = (await req.json()) as {
      referenceMonth?: string;
      deterministicSummary?: Record<string, unknown>;
    };

    if (!payload?.deterministicSummary) {
      return new Response(
        JSON.stringify({
          error: 'O contexto determinístico consolidado é obrigatório.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        modelPolicy:
          'no-training-on-user-data; deterministic-calculations-only; no-speculative-assets',
        referenceMonth: payload.referenceMonth ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : 'Erro ao processar análise no Orientador Financeiro.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
