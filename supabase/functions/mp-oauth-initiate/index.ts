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
    // Para este exemplo, vamos assumir que o ID do usuário está sendo passado.
    // Em um app real, você pegaria o ID do usuário logado através do token de autenticação.
    // Vamos simplificar por enquanto.
    const MOCK_USER_ID = "a0e84c98-1c32-4913-9a34-7d52f2814300"; // SUBSTITUA POR UM UUID DE USUÁRIO VÁLIDO DA SUA TABELA 'users' OU 'profiles'

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Gera o 'state' (nossa chave secreta)
    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // Expira em 10 minutos

    // Salva a chave no banco de dados para podermos conferir na volta
    const { error: insertError } = await supabaseAdmin
      .from('mp_oauth_states')
      .insert({ state: state, user_id: MOCK_USER_ID, expires_at: expiresAt });

    if (insertError) {
      console.error("Erro ao salvar o state:", insertError);
      throw new Error('Não foi possível iniciar o processo de autorização.');
    }

    // Monta a URL para redirecionar o usuário para o Mercado Pago
    const clientId = Deno.env.get('MP_CLIENT_ID');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`;

    const authUrl = new URL('https://auth.mercadopago.com/authorization');
    authUrl.searchParams.set('client_id', clientId!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);

    // Retorna a URL completa para o frontend
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
