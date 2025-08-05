import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cabeçalhos para permitir que a página de auth se comunique com o frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Início da Função Principal ---
Deno.serve(async (req) => {
  // Lida com a requisição CORS preflight, necessária para alguns navegadores
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. Extração e Validação dos Parâmetros da URL ---
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Parâmetros inválidos: o código de autorização e o state são obrigatórios.');
    }

    // --- 2. Inicialização do Cliente Supabase com Permissões de Admin ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Erro de configuração: Variáveis de ambiente da Supabase não encontradas.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // --- 3. Busca das Credenciais da Aplicação no Supabase Vault (Método Seguro) ---
    const { data: secretsData, error: secretsError } = await supabaseAdmin
      .from('vault.decrypted_secrets')
      .select('name, secret')
      .in('name', ['MP_CLIENT_ID', 'MP_CLIENT_SECRET']);

    if (secretsError) {
      console.error('Erro ao buscar segredos do Vault:', secretsError);
      throw new Error(`Erro de banco de dados ao buscar segredos: ${secretsError.message}`);
    }

    const clientId = secretsData?.find(s => s.name === 'MP_CLIENT_ID')?.secret;
    const clientSecret = secretsData?.find(s => s.name === 'MP_CLIENT_SECRET')?.secret;

    if (!clientId || !clientSecret) {
      throw new Error('Não foi possível obter as credenciais da aplicação no Vault. Verifique se os nomes MP_CLIENT_ID e MP_CLIENT_SECRET existem no Vault.');
    }

    // --- 4. Troca do Código de Autorização pelo Access Token do Vendedor ---
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

    // --- 5. Validação do 'state' e Obtenção do ID do Usuário ---
    const { data: stateRow, error: stateError } = await supabaseAdmin
      .from('mp_oauth_states')
      .delete() // Deleta o state após o uso para prevenir replay attacks
      .eq('state', state)
      .select('user_id')
      .single();

    if (stateError || !stateRow) {
      throw new Error('State de autorização inválido, expirado ou já utilizado.');
    }
    const userId = stateRow.user_id;
    
    // --- 6. Criptografia e Armazenamento dos Tokens do Vendedor ---
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) {
        throw new Error('Chave de criptografia (TOKEN_ENCRYPTION_KEY) não configurada no servidor.');
    }
    
    const { data: encryptedAccessToken, error: encryptErrorAccess } = await supabaseAdmin.rpc('encrypt_secret', {
        secret_value: tokenData.access_token,
        encryption_key: encryptionKey,
    });
    
    const { data: encryptedRefreshToken, error: encryptErrorRefresh } = await supabaseAdmin.rpc('encrypt_secret', {
        secret_value: tokenData.refresh_token,
        encryption_key: encryptionKey,
    });

    if (encryptErrorAccess || encryptErrorRefresh) {
        console.error('Erro ao chamar a função de criptografia RPC:', encryptErrorAccess || encryptErrorRefresh);
        throw new Error('Falha de segurança ao preparar credenciais.');
    }

    const tokenInfoToStore = {
      user_id: userId,
      mp_user_id: tokenData.user_id,
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      public_key: tokenData.public_key,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
    };
    
    const { error: upsertError } = await supabaseAdmin
      .from('mp_oauth_tokens')
      .upsert(tokenInfoToStore, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Erro ao salvar os tokens do vendedor no banco de dados:', upsertError);
      throw new Error('Não foi possível armazenar as credenciais do vendedor.');
    }

    console.log(`SUCESSO! Tokens do usuário ${userId} foram salvos no banco de dados.`);

    // --- 7. Retorno de Sucesso para o Frontend ---
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
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    // --- Bloco de Captura de Erros ---
    console.error('ERRO NO FLUXO DE CALLBACK:', error.message);
    return new Response(
      `<html><body><p>Ocorreu um erro: ${error.message}</p></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});
