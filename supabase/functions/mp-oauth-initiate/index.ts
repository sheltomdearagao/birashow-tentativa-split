import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.150.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- ESTA É A MUDANÇA PRINCIPAL ---
    // 1. Criamos um cliente Supabase que "herda" a autenticação do frontend.
    // O token de acesso do usuário é passado no cabeçalho 'Authorization'.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Usamos o cliente para pegar as informações do usuário que está logado.
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Erro de autenticação:', userError);
      throw new Error('Usuário inválido ou não autenticado. Faça o login novamente.');
    }
    // --- FIM DA MUDANÇA ---

    // Agora, em vez de um MOCK_USER_ID, usamos o ID do usuário real que foi encontrado.
    const userId = user.id;
    console.log(`Iniciando conexão para o usuário: ${userId}`);

    // O resto do código continua igual, mas agora usando o userId real.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from('mp_oauth_states')
      .insert({ state: state, user_id: userId, expires_at: expiresAt });

    if (insertError) {
      console.error("Erro ao salvar o state:", insertError);
      throw new Error('Não foi possível iniciar o processo de autorização.');
    }

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`;

    const authUrl = new URL('https://auth.mercadopago.com/authorization');
    authUrl.searchParams.set('client_id', clientId!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    return new Response(JSON.stringify({ authorization_url: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
