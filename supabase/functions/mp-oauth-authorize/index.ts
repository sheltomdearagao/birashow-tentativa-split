import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Gerar state único para segurança CSRF
    const state = crypto.randomUUID()
    
    // Buscar credenciais do Mercado Pago
    const { data: secretData, error: secretError } = await supabase
      .from('vault.decrypted_secrets')
      .select('secret')
      .eq('name', 'MP_CLIENT_ID')
      .single()

    if (secretError || !secretData) {
      console.error('Erro ao buscar MP_CLIENT_ID:', secretError)
      throw new Error('Credenciais não encontradas')
    }

    const clientId = secretData.secret

    // Construir URL de autorização
    const authUrl = new URL('https://auth.mercadopago.com/authorization')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('platform_id', 'mp')
    authUrl.searchParams.set('redirect_uri', `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`)
    authUrl.searchParams.set('state', state)

    // Armazenar state temporariamente no banco (opcional - pode usar localStorage no frontend)
    await supabase
      .from('mp_oauth_states')
      .insert([{
        user_id: user.id,
        state: state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutos
      }])

    return new Response(
      JSON.stringify({ 
        authorization_url: authUrl.toString(),
        state: state
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Erro na autorização MP:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})