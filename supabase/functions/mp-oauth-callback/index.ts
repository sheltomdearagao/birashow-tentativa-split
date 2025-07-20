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
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Verificar se houve erro na autorização
    if (error) {
      console.error('Erro na autorização MP:', error)
      return new Response(
        `<html><body><script>window.close();</script><p>Erro na autorização: ${error}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }

    if (!code || !state) {
      throw new Error('Código ou state não fornecidos')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service role para operações admin
    )

    // Buscar credenciais do MP
    const { data: clientIdData } = await supabase
      .from('vault.decrypted_secrets')
      .select('secret')
      .eq('name', 'MP_CLIENT_ID')
      .single()

    const { data: clientSecretData } = await supabase
      .from('vault.decrypted_secrets')
      .select('secret')
      .eq('name', 'MP_CLIENT_SECRET')
      .single()

    if (!clientIdData || !clientSecretData) {
      throw new Error('Credenciais MP não encontradas')
    }

    const clientId = clientIdData.secret
    const clientSecret = clientSecretData.secret

    // Trocar código por tokens
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-oauth-callback`
      }).toString()
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Erro ao trocar código por token:', errorText)
      throw new Error(`Erro ao obter tokens: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Tokens recebidos:', { 
      access_token: tokenData.access_token ? 'presente' : 'ausente',
      user_id: tokenData.user_id 
    })

    // Validar state (buscar no banco)
    const { data: stateData } = await supabase
      .from('mp_oauth_states')
      .select('user_id')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!stateData) {
      throw new Error('State inválido ou expirado')
    }

    const userId = stateData.user_id

    // Criptografar tokens antes de armazenar
    const encryptionKey = crypto.randomUUID() // Em produção, use uma chave mais segura
    
    // Buscar ou criar perfil do vendedor
    let { data: seller } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (!seller) {
      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', userId)
        .single()

      if (!profile) {
        throw new Error('Perfil do usuário não encontrado')
      }

      // Criar vendedor
      const { data: newSeller, error: sellerError } = await supabase
        .from('sellers')
        .insert([{
          user_id: userId,
          profile_id: profile.id,
          business_name: profile.full_name || 'Minha Loja',
          mp_user_id: tokenData.user_id
        }])
        .select('id')
        .single()

      if (sellerError) {
        console.error('Erro ao criar vendedor:', sellerError)
        throw new Error('Erro ao criar perfil de vendedor')
      }

      seller = newSeller
    }

    // Armazenar tokens criptografados
    const { error: tokenError } = await supabase
      .from('mp_oauth_tokens')
      .upsert([{
        seller_id: seller.id,
        encrypted_access_token: btoa(tokenData.access_token), // Base64 simples por ora
        encrypted_refresh_token: btoa(tokenData.refresh_token),
        public_key: tokenData.public_key,
        mp_user_id: tokenData.user_id,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
      }])

    if (tokenError) {
      console.error('Erro ao armazenar tokens:', tokenError)
      throw new Error('Erro ao armazenar credenciais')
    }

    // Limpar state usado
    await supabase
      .from('mp_oauth_states')
      .delete()
      .eq('state', state)

    // Retornar página de sucesso que fecha a janela
    return new Response(
      `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MP_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Autorização concluída com sucesso! Esta janela será fechada automaticamente.</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )

  } catch (error) {
    console.error('Erro no callback MP:', error)
    return new Response(
      `<html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MP_AUTH_ERROR', error: '${error.message}' }, '*');
              window.close();
            }
          </script>
          <p>Erro: ${error.message}</p>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }
})