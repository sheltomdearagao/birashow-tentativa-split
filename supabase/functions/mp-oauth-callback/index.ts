import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Início da Função Principal ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Parâmetros inválidos: o código de autorização e o state são obrigatórios.');
    }

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
      console.error('ERRO DE CONFIGURAÇÃO: Variáveis de ambiente não foram encontradas.');
      throw new Error('Erro de configuração interna do servidor.');
    }

    // --- MUDANÇA PRINCIPAL: TROCANDO AXIOS POR FETCH ---
    const tokenUrl = 'https://api.mercadopago.com/oauth/token';
    const redirectUri = `${supabaseUrl}/functions/v1/mp-oauth-callback`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body,
    });
    
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error('Erro na API do Mercado Pago ao obter token:', tokenData);
        throw new Error(tokenData.message || 'Falha ao obter o token de acesso.');
    }
    // --- FIM DA MUDANÇA ---

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: stateRow, error: stateError } = await supabaseAdmin
      .from('mp_oauth_states')
      .delete()
      .eq('state', state)
      .select('user_id')
      .single();

    if (stateError || !stateRow) {
      throw new Error('State de autorização inválido, expirado ou já utilizado.');
    }
    const userId = stateRow.user_id;

    console.log(`SUCESSO! Token do usuário ${userId} recebido. Vamos salvar no banco.`);

    // TODO: Adicionar a lógica para criptografar (usando a função SQL) e salvar o token na sua tabela 'mp_oauth_tokens'.
    // Ex: const { error } = await supabaseAdmin.from('mp_oauth_tokens').upsert({ user_id: userId, encrypted_access_token: ... });

    return new Response(
      `<html><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MP_AUTH_SUCCESS' }, '*');
              window.close();
            }
          </script>
          <p>Autorização concluída com sucesso!</p>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('ERRO NO FLUXO DE CALLBACK:', error.message);
    return new Response(
      `<html><body><p>Ocorreu um erro: ${error.message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
