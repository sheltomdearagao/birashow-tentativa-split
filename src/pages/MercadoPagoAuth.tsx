import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function MercadoPagoAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState<any>(null);

  const handleMercadoPagoAuth = async () => {
    try {
      setIsLoading(true);
      
      // Verificar se o usuário está logado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para conectar ao Mercado Pago",
          variant: "destructive"
        });
        return;
      }

      // Chamar a edge function para iniciar OAuth
      const { data, error } = await supabase.functions.invoke('mp-oauth-authorize', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (error) {
        console.error('Erro ao iniciar OAuth:', error);
        toast({
          title: "Erro",
          description: "Erro ao conectar com Mercado Pago: " + error.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Dados recebidos:', data);
      
      if (data.authorization_url) {
        // Abrir popup para autorização
        const popup = window.open(
          data.authorization_url,
          'mp-auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Escutar mensagens do popup
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'MP_AUTH_SUCCESS') {
            popup?.close();
            window.removeEventListener('message', handleMessage);
            
            setAuthData({
              status: 'success',
              message: 'Autorização concluída com sucesso!'
            });
            
            toast({
              title: "Sucesso!",
              description: "Conta Mercado Pago conectada com sucesso!"
            });
          } else if (event.data.type === 'MP_AUTH_ERROR') {
            popup?.close();
            window.removeEventListener('message', handleMessage);
            
            setAuthData({
              status: 'error',
              message: event.data.error
            });
            
            toast({
              title: "Erro",
              description: "Erro na autorização: " + event.data.error,
              variant: "destructive"
            });
          }
        };

        window.addEventListener('message', handleMessage);

        // Verificar se o popup foi fechado manualmente
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            setIsLoading(false);
          }
        }, 1000);
      }

    } catch (error: any) {
      console.error('Erro no processo de autorização:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado: " + error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Conectar Mercado Pago</CardTitle>
          <CardDescription>
            Conecte sua conta do Mercado Pago para habilitar pagamentos com split automático
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-medium mb-2">Configuração do Split:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Taxa da plataforma: R$ 1,00 por transação</li>
              <li>• Valor restante: 100% para o vendedor</li>
              <li>• Processamento automático</li>
            </ul>
          </div>

          <Button 
            onClick={handleMercadoPagoAuth}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Conectando..." : "Conectar com Mercado Pago"}
          </Button>

          {authData && (
            <div className={`p-4 rounded-lg ${authData.status === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <p className="text-sm font-medium">
                {authData.status === 'success' ? '✅ ' : '❌ '}
                {authData.message}
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center">
            <p>Esta integração permite que você receba pagamentos através do Mercado Pago com divisão automática de valores.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}