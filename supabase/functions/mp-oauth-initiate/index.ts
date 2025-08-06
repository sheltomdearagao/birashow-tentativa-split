import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.150.0/crypto/mod.ts";

// Estes são os cabeçalhos de permissão (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permite qualquer origem (para teste)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // O navegador envia uma requisição 'OPTIONS' antes do POST para checar as permissões.
  // Precisamos responder a ela com os cabeçalhos CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Pega o usuário logado a partir do token de autenticação enviado pelo frontend
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Usuário inválido ou não autenticado.');
    }
    const userId = user.id;

    // 2. O resto da lógica que já tínhamos: criar o state e salvar no banco
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from('mp_oauth_states')
      .insert({ state: state, user_id: userId, expires_at: expiresAt });

    if (insertError) throw new Error('Não foi possível iniciar o processo de autorização.');

    // 3. Monta e retorna a URL de autorização do Mercado Pago
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`;
    const authUrl = new URL('https://auth.mercadopago.com/authorization');
    authUrl.searchParams.set('client_id', clientId!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    // Retorna a resposta de sucesso COM os cabeçalhos CORS
    return new Response(JSON.stringify({ authorization_url: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // Retorna a resposta de erro COM os cabeçalhos CORS
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
