import React, { useState } from 'react';

// Este é o seu componente/página React
const MercadoPagoAuthPage = () => {
  // Usamos um 'state' para saber se estamos carregando a requisição
  // e para desabilitar o botão, evitando múltiplos cliques.
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esta é a função que será chamada quando o botão for clicado
  const handleConnectClick = async () => {
    setIsLoading(true); // Começamos a carregar
    setError(null);    // Limpamos erros antigos

    try {
      // 1. Chamamos a sua função na Supabase que gera a "chave" (state)
      // e nos devolve a URL de autorização.
      // Lembre-se que essa função precisa existir na sua pasta /supabase/functions/mp-oauth-initiate
      const response = await fetch('/functions/v1/mp-oauth-initiate', {
        method: 'POST', // É uma boa prática usar POST para criar um recurso (o 'state')
        headers: {
          // Se sua função de 'initiate' precisar de autenticação, passe o token aqui.
          // Ex: 'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        // Se a resposta do backend der erro, nós o capturamos aqui
        throw new Error(data.error || 'Não foi possível iniciar a conexão.');
      }

      // 2. Se tudo deu certo, pegamos a URL e redirecionamos o usuário
      // para a página de autorização do Mercado Pago.
      const { authorization_url } = data;
      if (authorization_url) {
        window.location.href = authorization_url;
      } else {
        throw new Error('URL de autorização não recebida do servidor.');
      }

    } catch (err: any) {
      // Se qualquer parte do processo falhar, mostramos o erro
      console.error('Erro ao conectar com Mercado Pago:', err);
      setError(err.message);
      setIsLoading(false); // Paramos de carregar
    }
  };

  // Esta é a parte visual do seu componente (o que aparece na tela)
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
      <p>Clique no botão abaixo para autorizar o nosso aplicativo a transferir os pagamentos para a sua conta.</p>
      
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
