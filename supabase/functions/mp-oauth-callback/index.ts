import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Buffer } from 'https://deno.land/std@0.138.0/node/buffer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Início da Função Principal ---
Deno.serve(async (req) => {
  // Lida com a requisição CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- 1. Extração e Validação Inicial dos Parâmetros ---
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
      throw new Error('Erro de configuração do servidor: as variáveis de ambiente da Supabase não foram encontradas.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // --- 3. Busca das Credenciais da Aplicação no Supabase Vault ---
    // Fazemos uma única query para buscar ambos os segredos
    const { data: secretsData, error: secretsError } = await supabaseAdmin
      .from('vault.decrypted_secrets')
      .select('name, secret')
      .in('name', ['MP_CLIENT_ID', 'MP_CLIENT_SECRET']);

    if (secretsError || !secretsData || secretsData.length < 2) {
      console.error('Erro ao buscar segredos do Vault:', secretsError);
      throw new Error('Não foi possível obter as credenciais da aplicação no Vault.');
    }
    
    const clientId = secretsData.find(s => s.name === 'MP_CLIENT_ID')?.secret;
    const clientSecret = secretsData.find(s => s.name === 'MP_CLIENT_SECRET')?.secret;

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais da aplicação (MP_CLIENT_ID ou MP_CLIENT_SECRET) não encontradas no Vault.');
    }

    // --- 4. Troca do Código de Autorização pelo Access Token do Vendedor ---
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: `${supabaseUrl}/functions/v1/mp-oauth-callback`,
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Erro na API do Mercado Pago ao obter token:', tokenData);
      throw new Error(`Erro ao obter tokens: ${tokenData.message || tokenResponse.status}`);
    }

    // --- 5. Validação do Parâmetro 'state' para Segurança (CSRF) ---
    const { data: stateRow, error: stateError } = await supabaseAdmin
      .from('mp_oauth_states')
      .delete() // Já deletamos aqui para ser uma operação atômica
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .select('user_id')
      .single();

    if (stateError || !stateRow) {
      throw new Error('State de autorização inválido, expirado ou já utilizado.');
    }
    const userId = stateRow.user_id;

    // --- 6. Armazenamento Seguro dos Tokens do Vendedor ---
    // A chave de criptografia DEVE ser gerenciada de forma segura (ex: Supabase Vault)
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) {
        throw new Error('Chave de criptografia não configurada no servidor.');
    }
    
    // Criptografia REAL usando pgsodium
    const { data: encryptedAccessToken, error: encryptErrorAccess } = await supabaseAdmin.rpc('encrypt_secret', {
        secret_value: tokenData.access_token,
        encryption_key: encryptionKey,
    });
    
    const { data: encryptedRefreshToken, error: encryptErrorRefresh } = await supabaseAdmin.rpc('encrypt_secret', {
        secret_value: tokenData.refresh_token,
        encryption_key: encryptionKey,
    });

    if (encryptErrorAccess || encryptErrorRefresh) {
        console.error('Erro ao criptografar tokens:', encryptErrorAccess || encryptErrorRefresh);
        throw new Error('Falha de segurança ao preparar credenciais.');
    }

    const tokenInfoToStore = {
      user_id: userId, // Vinculamos diretamente ao usuário autenticado
      mp_user_id: tokenData.user_id,
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      public_key: tokenData.public_key,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    };
    
    const { error: upsertError } = await supabaseAdmin
      .from('mp_oauth_tokens')
      .upsert(tokenInfoToStore, { onConflict: 'user_id' }); // Atualiza se o usuário já tiver tokens

    if (upsertError) {
      console.error('Erro ao salvar os tokens do vendedor:', upsertError);
      throw new Error('Não foi possível armazenar as credenciais do vendedor.');
    }
    
    // --- 7. Retorno de Sucesso para o Frontend ---
    return new Response(
      `<html><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MP_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/sucesso'; // Página de fallback
            }
          </script>
          <p>Autorização concluída! Esta janela será fechada.</p>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    // --- Bloco de Captura de Erros ---
    console.error('ERRO GERAL NO FLUXO DE CALLBACK DO MP:', error.message);
    return new Response(
      `<html><body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MP_AUTH_ERROR', error: '${error.message}' }, '*');
              window.close();
            }
          </script>
          <p>Ocorreu um erro: ${error.message}</p>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
