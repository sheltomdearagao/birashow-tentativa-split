import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import axios from 'https://esm.sh/axios@1.6.8'; // Usando axios para consistência

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
    // --- 1. Extração dos Parâmetros da URL ---
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Parâmetros inválidos: o código de autorização e o state são obrigatórios.');
    }

    // --- 2. Busca das Credenciais da Aplicação do Ambiente ---
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey) {
      console.error('ERRO DE CONFIGURAÇÃO: Uma ou mais variáveis de ambiente (MP_CLIENT_ID, MP_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) não foram encontradas.');
      throw new Error('Erro de configuração interna do servidor.');
    }
    
    // --- 3. Troca do Código pelo Access Token do Vendedor ---
    const tokenUrl = 'https://api.mercadopago.com/oauth/token';
    const redirectUri = `${supabaseUrl}/functions/v1/mp-oauth-callback`;

    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await axios.post(tokenUrl, postData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    const tokenData = tokenResponse.data;

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

    // AQUI você deve adicionar a criptografia e o armazenamento no banco,
    // como no código anterior, se a sua tabela 'mp_oauth_tokens' já estiver pronta.
    // Por simplicidade, vamos apenas logar o sucesso por enquanto.
    console.log(`SUCESSO! Token do usuário ${userId} recebido. Access Token: ${tokenData.access_token}`);

    // TODO: Adicionar a lógica para criptografar e salvar o token no banco de dados.

    // --- 5. Retorno de Sucesso ---
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
    console.error('ERRO NO FLUXO DE CALLBACK:', error.response ? error.response.data : error.message);
    return new Response(
      `<html><body><p>Ocorreu um erro: ${error.message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
});
