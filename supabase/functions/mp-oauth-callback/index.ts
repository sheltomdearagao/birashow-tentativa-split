import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ... (cabeçalhos CORS)

Deno.serve(async (req) => {
  // ... (verificação de OPTIONS)

  try {
    // ... (parsing de code e state da URL)

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Erro de configuração: Variáveis de ambiente da Supabase não encontradas.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // --- LÓGICA CORRETA USANDO O VAULT ---
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
    // --- FIM DA LÓGICA DO VAULT ---

    // ... (resto do código para trocar o token, validar o state e salvar no banco)
    // O resto do código da penúltima versão que te enviei está correto.
    // A única mudança é voltar a usar a busca no Vault em vez de Deno.env.get() para as credenciais do MP.

  } catch (error) {
    // ... (bloco de catch)
  }
});
