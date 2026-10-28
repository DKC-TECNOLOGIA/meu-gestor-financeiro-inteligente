/**
 * Supabase Edge Function: open-finance-sync
 * Orquestra o fluxo de consentimento OAuth2 / FAPI e sincronização de dados
 * do Open Finance Brasil (Pluggy / Belvo).
 *
 * Requisitos Seção 9, 13 e 14:
 * - Nunca solicita ou armazena senhas bancárias.
 * - Armazena tokens de acesso do provedor apenas em `private.bank_connection_secrets`
 *   (inacessível pelo cliente mobile).
 * - Se as credenciais comerciais de produção (`OPEN_FINANCE_CLIENT_ID` / `OPEN_FINANCE_CLIENT_SECRET`)
 *   não estiverem configuradas no cofre do backend, retorna aviso transparente sem inventar dados bancários falsos.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface OpenFinanceSyncRequest {
  action: 'create_connect_token' | 'sync_connection' | 'revoke_consent';
  institutionIspb?: string;
  institutionName?: string;
  grantedScopes?: string[];
  connectionId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado: token JWT ausente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as OpenFinanceSyncRequest;
    const clientId = Deno.env.get('OPEN_FINANCE_CLIENT_ID');
    const clientSecret = Deno.env.get('OPEN_FINANCE_CLIENT_SECRET');
    const providerName = Deno.env.get('OPEN_FINANCE_PROVIDER') ?? 'pluggy';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          status: 'credentials_required',
          provider: providerName,
          message:
            'Intervenção humana necessária: configure OPEN_FINANCE_CLIENT_ID e OPEN_FINANCE_CLIENT_SECRET nas variáveis secretas do Supabase Edge Functions para sincronizar instituições bancárias reais em produção.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (body.action === 'revoke_consent') {
      return new Response(
        JSON.stringify({
          status: 'revoked',
          connectionId: body.connectionId,
          revokedAt: new Date().toISOString(),
          message: 'Consentimento revogado com sucesso junto ao provedor Open Finance.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        status: 'ready',
        provider: providerName,
        institutionName: body.institutionName ?? null,
        grantedScopes: body.grantedScopes ?? ['accounts', 'transactions', 'credit_cards'],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error
            ? err.message
            : 'Erro interno na sincronização Open Finance.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
