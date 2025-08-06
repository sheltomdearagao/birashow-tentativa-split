import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Início da Função Principal ---
Deno.serve(async (req) => {
  // Lida com a requisição CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. Extração dos Parâmetros da URL ---
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Parâmetros inválidos: o código de autorização e o state são obrigatórios.');
    }

    // --- 2. Busca das Credenciais do Ambiente da Função ---
    // ESTA É A MUDANÇA PRINCIPAL: Lendo diretamente dos secrets da função, sem usar o Vault.
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey || !encryptionKey) {
      console.error('ERRO DE CONFIGURAÇÃO: Uma ou mais variáveis de ambiente não foram encontradas nos Secrets da Função.');
      throw new Error('Erro de configuração interna do servidor.');
    }

    // --- 3. Troca do Código pelo Access Token do Vendedor ---
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body,
    });
    
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        console.error('Erro na API do Mercado Pago:', tokenData);
        throw new Error(tokenData.message || 'Falha ao obter o token de acesso.');
    }

    // --- 4. Validação do 'state' e Armazenamento dos Tokens ---
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

    const { data: encryptedAccessToken, error: encryptErrorAccess } = await supabaseAdmin.rpc('encrypt_secret', {
        secret_value: tokenData.access_token,
        encryption_key: encryptionKey,
    });
    
    const { data: encryptedRefreshToken, error: encryptErrorRefresh } = await supabaseAdmin.rpc('encrypt_secret', {
        secret_value: tokenData.refresh_token,
        encryption_key: encryptionKey,
    });

    if (encryptErrorAccess || encryptErrorRefresh) {
        throw new Error('Falha de segurança ao preparar credenciais.');
    }

    const { error: upsertError } = await supabaseAdmin
      .from('mp_oauth_tokens')
      .upsert({
        user_id: userId,
        mp_user_id: tokenData.user_id,
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        public_key: tokenData.public_key,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      throw new Error('Não foi possível armazenar as credenciais do vendedor.');
    }

    // --- 5. Retorno de Sucesso ---
    return new Response(
      `<html><body><script>if (window.opener) { window.opener.postMessage({ type: 'MP_AUTH_SUCCESS' }, '*'); window.close(); }</script><p>Autorização concluída com sucesso!</p></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('ERRO NO FLUXO DE CALLBACK:', error.message);
    return new Response(
      `<html><body><p>Ocorreu um erro: ${error.message}</p></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});
