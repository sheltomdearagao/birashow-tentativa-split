import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- PASSO 1: PREENCHA SUAS CREDENCIAIS AQUI ---
// Você encontra essas chaves no painel da Supabase em: Settings > API
const supabaseUrl = 'https://jqzvaqkaenwdinfxzqmd.supabase.co'; // JÁ PREENCHI PRA VOCÊ
const supabaseAnonKey = '449d795d3dbe4d1c6395119be794fc961c38a48a12150c5380720f200492aa4c'; // PREENCHA ESTA CHAVE

// Cria o cliente Supabase que será usado no componente
const supabase = createClient(supabaseUrl, supabaseAnonKey);


// --- INÍCIO DO COMPONENTE REACT ---
const MercadoPagoAuthPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função que é chamada quando o botão é clicado
  const handleConnectClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Pega a sessão do usuário logado para obter o token de acesso
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Você precisa estar logado para conectar uma conta.');
      }

      // Chama a função de backend 'mp-oauth-initiate' com o token de autorização
      const response = await fetch('https://jqzvaqkaenwdinfxzqmd.supabase.co/functions/v1/mp-oauth-initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível iniciar a conexão.');
      }

      // Redireciona o usuário para a URL de autorização do Mercado Pago
      const { authorization_url } = data;
      if (authorization_url) {
        window.location.href = authorization_url;
      } else {
        throw new Error('URL de autorização não recebida do servidor.');
      }

    } catch (err: any) {
      console.error('Erro ao conectar com Mercado Pago:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Parte visual do componente (o que é renderizado na tela)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#1a202c',
      color: 'white',
      fontFamily: 'sans-serif'
    }}>
      <h1>Conectar sua Conta do Mercado Pago</h1>
      <p>Clique no botão abaixo para autorizar nosso aplicativo a gerenciar pagamentos.</p>
      
      <button
        onClick={handleConnectClick}
        disabled={isLoading}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          backgroundColor: '#facc15',
          color: '#1a202c',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold'
        }}
      >
        {isLoading ? 'Aguardando...' : 'Conectar com Mercado Pago'}
      </button>

      {error && (
        <p style={{ color: '#f87171', marginTop: '16px' }}>
          Ocorreu um erro: {error}
        </p>
      )}
    </div>
  );
};

export default MercadoPagoAuthPage;
