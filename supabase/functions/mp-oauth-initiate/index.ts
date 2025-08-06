import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      throw new Error('Parâmetros inválidos');
    }

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const encryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY');

    if (!clientId || !clientSecret || !supabaseUrl || !serviceRoleKey || !encryptionKey) {
      throw new Error('Erro de configuração interna do servidor.');
    }

    const tokenUrl = 'https://api.mercadopago.com/oauth/token';
    const redirectUri = `${supabaseUrl}/functions/v1/mp-oauth-callback`;

    const body = new URLSearchParams({ /* ... corpo da requisição ... */ });
    
    const tokenResponse = await fetch(tokenUrl, { /* ... opções do fetch ... */ });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        throw new Error(tokenData.message || 'Falha ao obter o token de acesso.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: stateRow, error: stateError } = await supabaseAdmin
      .from('mp_oauth_states')
      .delete()
      .eq('state', state)
      .select('user_id')
      .single();

    if (stateError || !stateRow) {
      throw new Error('State de autorização inválido.');
    }
    const userId = stateRow.user_id;

    // --- LÓGICA DE VENDEDOR ADICIONADA AQUI ---

    // 1. Procuramos se já existe um vendedor para este usuário
    let { data: seller, error: sellerSelectError } = await supabaseAdmin
      .from('sellers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (sellerSelectError && sellerSelectError.code !== 'PGRST116') {
      // PGRST116 = 'single() did not return a row', o que é normal se o vendedor não existe.
      // Qualquer outro erro é um problema real.
      throw new Error('Erro ao buscar perfil de vendedor: ' + sellerSelectError.message);
    }
    
    // 2. Se não existir, criamos um novo vendedor
    if (!seller) {
      console.log(`Vendedor para o usuário ${userId} não encontrado. Criando um novo...`);
      const { data: newSeller, error: sellerInsertError } = await supabaseAdmin
        .from('sellers')
        .insert({ user_id: userId, business_name: 'Nova Barbearia' }) // Você pode adicionar mais campos aqui
        .select('id')
        .single();
      
      if (sellerInsertError) {
        throw new Error('Erro ao criar perfil de vendedor: ' + sellerInsertError.message);
      }
      seller = newSeller;
    }

    console.log(`Processando para o vendedor com ID: ${seller.id}`);

    // --- FIM DA LÓGICA DE VENDEDOR ---

    const { data: encryptedAccessToken, error: encryptErrorAccess } = await supabaseAdmin.rpc('encrypt_secret', { /* ... */ });
    const { data: encryptedRefreshToken, error: encryptErrorRefresh } = await supabaseAdmin.rpc('encrypt_secret', { /* ... */ });

    if (encryptErrorAccess || encryptErrorRefresh) {
        throw new Error('Falha de segurança ao preparar credenciais.');
    }

    // Agora usamos o seller.id para salvar o token
    const { error: upsertError } = await supabaseAdmin
      .from('mp_oauth_tokens')
      .upsert({
        seller_id: seller.id, // VINCULADO AO VENDEDOR
        user_id: userId,      // MANTEMOS O VÍNCULO COM O USUÁRIO TAMBÉM
        mp_user_id: tokenData.user_id,
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        public_key: tokenData.public_key,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      }, { onConflict: 'seller_id' }); // IMPORTANTE: onConflict agora é no seller_id

    if (upsertError) {
      throw new Error('Não foi possível armazenar as credenciais do vendedor.');
    }

    return new Response(
      `<html><body><script>/* ... */</script><p>Autorização concluída com sucesso!</p></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    // ...
  }
});
