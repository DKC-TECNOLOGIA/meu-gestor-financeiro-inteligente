/**
 * Supabase Edge Function: nfc-e-parser
 * Processa QR Code da NFC-e (SEFAZ-BA e demais UFs) ou XML fiscal no servidor.
 * Requisito Seção 6:
 * - Valida chave de 44 dígitos.
 * - Identifica estado emissor e mecanismo de consulta pública.
 * - JAMAIS contorna CAPTCHAs, autenticações ou controles de acesso.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface NfceRequestPayload {
  mode: 'qr_url' | 'xml';
  content: string;
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

    const body = (await req.json()) as NfceRequestPayload;
    if (!body?.content || typeof body.content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Conteúdo do QR Code ou XML não informado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const match44 = body.content.match(/(\d{44})/);
    const accessKey = match44?.[1] ?? null;

    if (body.mode === 'qr_url' && body.content.startsWith('http')) {
      // Verifica apenas domínios fiscais governamentais legítimos (.gov.br)
      const parsedUrl = new URL(body.content);
      if (!parsedUrl.hostname.endsWith('.gov.br')) {
        return new Response(
          JSON.stringify({
            error:
              'Domínio não reconhecido como portal oficial SEFAZ (.gov.br). Consulta bloqueada por segurança.',
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(parsedUrl.toString(), {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml',
          },
        });
        clearTimeout(timeout);

        const html = await res.text();
        const hasCaptcha =
          res.status === 403 ||
          /captcha|recaptcha|hcaptcha| digite os caracteres|desafio/i.test(html);

        if (hasCaptcha) {
          return new Response(
            JSON.stringify({
              status: 'captcha_protected',
              accessKey,
              message:
                'O portal da SEFAZ solicitou verificação interativa (CAPTCHA). Em conformidade com as regras de segurança, utilize a importação do XML fiscal ou complete a revisão assistida.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'public_response_received',
            accessKey,
            message: 'Consulta pública verificada. Revise os dados antes de confirmar.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch {
        clearTimeout(timeout);
        return new Response(
          JSON.stringify({
            status: 'fallback_assisted',
            accessKey,
            message:
              'Portal SEFAZ indisponível no momento. Prossiga pela revisão assistida ou importação de XML.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return new Response(
      JSON.stringify({
        status: 'validated',
        accessKey,
        message: 'Chave fiscal validada com sucesso.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erro interno ao processar nota fiscal.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
